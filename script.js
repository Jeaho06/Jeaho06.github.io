document.addEventListener('DOMContentLoaded', function() {
  createBoard();
  setupPopupWindow();
});

// --- 전역 변수 ---
const board = Array(19).fill().map(() => Array(19).fill(0));
const gridSize = 30;
let isAITurn = false;
let lastMove = null;
let isFirstMove = true;
const cheatProbability = 0.4;
let bombState = { isArmed: false, col: null, row: null };
let moveCount = 0; // 수순 카운터

// --- 로깅 함수 ---
function logMove(count, message) {
  const moveLog = document.getElementById("move-log"); if (!moveLog) return;
  const messageElem = document.createElement("p");
  messageElem.innerHTML = `${count}. ${message}`;
  moveLog.appendChild(messageElem);
  moveLog.scrollTop = moveLog.scrollHeight;
}
function logReason(sender, message) {
  const reasonLog = document.getElementById("reasoning-log"); if (!reasonLog) return;
  const messageElem = document.createElement("p");
  messageElem.textContent = `${sender}: ${message}`;
  reasonLog.appendChild(messageElem);
  reasonLog.scrollTop = reasonLog.scrollHeight;
}

// --- 핵심 로직 ---
function createBoard() {
  const boardElement = document.getElementById("game-board"); if (!boardElement) return;
  for (let i = 0; i < 19; i++) {
    const lineH = document.createElement("div"); lineH.classList.add("line", "horizontal-line"); lineH.style.top = `${i * gridSize + gridSize / 2}px`; boardElement.appendChild(lineH);
    const lineV = document.createElement("div"); lineV.classList.add("line", "vertical-line"); lineV.style.left = `${i * gridSize + gridSize / 2}px`; boardElement.appendChild(lineV);
  }
  for (let i = 0; i < 19; i++) {
    const colLabel = document.createElement("div"); colLabel.className = "coordinate-label top-label"; colLabel.style.left = `${i * gridSize + gridSize / 2}px`; colLabel.textContent = String.fromCharCode(65 + i); boardElement.appendChild(colLabel);
    const rowLabel = document.createElement("div"); rowLabel.className = "coordinate-label left-label"; rowLabel.style.top = `${i * gridSize + gridSize / 2}px`; rowLabel.textContent = i + 1; boardElement.appendChild(rowLabel);
  }
  boardElement.addEventListener('click', (event) => {
    if (isAITurn) return;
    const rect = boardElement.getBoundingClientRect(); const offsetX = event.clientX - rect.left; const offsetY = event.clientY - rect.top;
    const closestX = Math.round((offsetX - gridSize / 2) / gridSize); const closestY = Math.round((offsetY - gridSize / 2) / gridSize);
    if (closestX < 0 || closestX >= 19 || closestY < 0 || closestY >= 19 || board[closestY][closestX] !== 0) return;
    if (isForbiddenMove(closestX, closestY, 1)) { logReason("시스템", "금수입니다! 다른 위치를 선택하세요."); return; }
    board[closestY][closestX] = 1; placeStone(closestX, closestY, 'black'); playSound("Movement.mp3");
    const userCoord = convertCoord(closestX, closestY);
    logMove(++moveCount, `사용자: ${userCoord}??`);
    if (checkWin(board, 1)) { logReason("시스템", "사용자가 승리했습니다!"); isAITurn = true; return; }
    isAITurn = true; setTimeout(aiMove, 1000);
  });
}

/**
 * AI의 턴을 관리하는 메인 함수 (로직 전면 수정)
 */
function aiMove() {
  if (bombState.isArmed) { detonateBomb(); return; }
  
  let moveAction;
  
  // 반칙을 시도할지 결정
  const willCheat = Math.random() < cheatProbability && !isFirstMove && lastMove;

  if (willCheat) {
    const availableCheats = [];
    if (document.getElementById('toggle-bomb').checked) { availableCheats.push(() => placeBomb()); }
    if (document.getElementById('toggle-double-move').checked) { availableCheats.push(() => performDoubleMove()); }
    if (document.getElementById('toggle-swap').checked) { availableCheats.push(() => performStoneSwap()); }

    if (availableCheats.length > 0) {
      const chosenCheat = availableCheats[Math.floor(Math.random() * availableCheats.length)];
      moveAction = chosenCheat;
    } else {
      // 반칙이 모두 비활성화되어 있으면 일반 수를 둠
      moveAction = () => performNormalMove();
    }
  } else {
    // 반칙 확률에 당첨되지 않으면 일반 수를 둠
    moveAction = () => performNormalMove();
  }
  
  // 결정된 행동 실행
  const actionResult = moveAction();
  
  // 행동이 동기적이고 성공적으로 끝났을 때만 턴 종료 처리
  if (actionResult && actionResult.isAsync === false) {
    if (checkWin(board, -1)) {
      logReason("시스템", "AI가 승리했습니다!");
      isAITurn = true;
    } else {
      isAITurn = false;
    }
  }
}


// --- 지능형 AI 로직 ---
function findBestMove() {
  let bestScore = -1; let bestMove = null; let bestReason = "전략적인 판단에 따라";
  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < 19; x++) {
      if (board[y][x] === 0) {
        let reason = "전략적인 판단에 따라";
        const myScoreContext = calculateScore(x, y, -1);
        const opponentScoreContext = calculateScore(x, y, 1);
        const myScore = myScoreContext.score;
        const opponentScore = opponentScoreContext.score;
        const totalScore = myScore + opponentScore;
        if (totalScore > bestScore) {
          bestScore = totalScore; bestMove = { col: x, row: y };
          if (opponentScore >= 100000) { reason = `상대방의 ${opponentScoreContext.patternName} 공격을 막기 위해`; }
          else if (myScore >= 100000) { reason = `치명적인 ${myScoreContext.patternName} 공격을 하기 위해`; }
          else if (opponentScore >= 5000) { reason = `상대방의 ${opponentScoreContext.patternName} 공격을 막기 위해`; }
          else if (myScore >= 5000) { reason = `강력한 ${myScoreContext.patternName} 공격을 하기 위해`; }
          else if (opponentScore >= 500) { reason = `상대방의 ${opponentScoreContext.patternName} 연결을 방해하기 위해`; }
          else if (myScore >= 500) { reason = `다음 공격을 위해 ${myScoreContext.patternName} 모양을 만들기 위해`; }
          bestReason = reason;
        }
      }
    }
  }
  return { move: bestMove, score: bestScore, reason: bestReason };
}
function calculateScore(x, y, player) {
  let totalScore = 0; let highestPatternScore = 0; let patternName = "연결";
  const patterns = { 1000000: "5목", 100000: "열린 4", 10000: "닫힌 4", 5000: "열린 3", 500: "닫힌 3", 100: "열린 2", 10: "닫힌 2", 1: "외로운 돌" };
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dx, dy] of directions) {
    const score = calculateScoreForLine(x, y, dx, dy, player);
    if (score > highestPatternScore) {
        highestPatternScore = score;
        for (const [s, name] of Object.entries(patterns).reverse()){ if(score >= s) { patternName = name; break; } }
    }
    totalScore += score;
  }
  return { score: totalScore, patternName: patternName };
}
function calculateScoreForLine(x, y, dx, dy, player) {
  let count = 1; let openEnds = 0;
  for (let i = 1; i < 5; i++) {
    const nx = x + i * dx; const ny = y + i * dy;
    if (nx < 0 || ny < 0 || nx >= 19 || ny >= 19) { openEnds++; break; }
    const stone = board[ny][nx];
    if (stone === player) count++; else { if (stone === 0) openEnds++; break; }
  }
  for (let i = 1; i < 5; i++) {
    const nx = x - i * dx; const ny = y - i * dy;
    if (nx < 0 || ny < 0 || nx >= 19 || ny >= 19) { openEnds++; break; }
    const stone = board[ny][nx];
    if (stone === player) count++; else { if (stone === 0) openEnds++; break; }
  }
  if (count >= 5) return 1000000;
  if (count === 4) return openEnds === 2 ? 100000 : 10000;
  if (count === 3) return openEnds === 2 ? 5000 : 500;
  if (count === 2) return openEnds === 2 ? 100 : 10;
  if (count === 1 && openEnds === 2) return 1;
  return 0;
}

// --- 행동 함수 및 유틸리티 ---
function performNormalMove() {
  const best = findBestMove(); const move = best.move; const reason = best.reason;
  if (move && board[move.row][move.col] === 0) {
    board[move.row][move.col] = -1; placeStone(move.col, move.row, 'white'); playSound("Movement.mp3");
    const aiCoord = convertCoord(move.col, move.row);
    logMove(++moveCount, `AI: ${aiCoord}`); // 수순 표시 수정
    logReason("AI", `저는 ${reason} ${aiCoord}곳에 두겠습니다.`);
    isFirstMove = false; return { isAsync: false };
  }
  logReason("시스템", "AI가 둘 곳을 찾지 못했습니다."); isAITurn = false; return { isAsync: true };
}
function checkWin(board, player) {
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < 19; x++) {
      if (board[y][x] === player) {
        for (const [dx, dy] of directions) {
          let count = 1;
          for (let i = 1; i < 5; i++) { const nx = x + i * dx; const ny = y + i * dy; if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === player) count++; else break; }
          if (count >= 5) return true;
        }
      }
    }
  }
  return false;
}
function isForbiddenMove(x, y, player) {
  if (player !== 1) return false;
  board[y][x] = player; let openThrees = 0;
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dx, dy] of directions) { if (calculateScoreForLine(x, y, dx, dy, player) === 5000) openThrees++; }
  board[y][x] = 0; return openThrees >= 2;
}

// --- 반칙 함수들 ---
function placeBomb() {
  const move = findBestBombLocation();
  if (move) {
    board[move.row][move.col] = 2; bombState = { isArmed: true, col: move.col, row: move.row };
    placeStone(move.col, move.row, 'bomb'); playSound("tnt_installation.mp3");
    const bombCoord = convertCoord(move.col, move.row);
    logMove(++moveCount, `AI: ${bombCoord}!!`); // 수순 표시 수정
    logReason("AI", `저는 ${bombCoord}에 폭탄을 설치하겠습니다. 여기가 좋아 보이네요.`);
    isAITurn = false; return { isAsync: true };
  }
  logReason("AI", "폭탄을 설치할 만한 좋은 장소를 찾지 못했습니다."); return false;
}
function detonateBomb() {
  const center = bombState; const centerCoord = convertCoord(center.col, center.row);
  logMove(++moveCount, `AI: ${centerCoord}💥!!`); // 수순 표시 수정
  logReason("AI", `${centerCoord}의 폭탄을 터뜨립니다!`); playSound("tnt_explosion.mp3");
  const boardElement = document.getElementById("game-board"); const bombEffect = document.createElement("div");
  bombEffect.className = "bomb-effect"; bombEffect.style.left = `${center.col * gridSize + gridSize / 2}px`; bombEffect.style.top = `${center.row * gridSize + gridSize / 2}px`;
  boardElement.appendChild(bombEffect);
  setTimeout(() => {
    for (let r = center.row - 1; r <= center.row + 1; r++) { for (let c = center.col - 1; c <= center.col + 1; c++) { if (r >= 0 && r < 19 && c >= 0 && c < 19) removeStone(c, r); } }
    bombEffect.remove(); bombState = { isArmed: false, col: null, row: null };
    if (checkWin(board, 1)) { logReason("시스템", "사용자가 승리했습니다!"); isAITurn = true; } else { isAITurn = false; }
  }, 500);
  return { isAsync: true };
}
function performDoubleMove() {
  const move1 = findBestMove().move;
  if (move1 && board[move1.row][move1.col] === 0) {
    board[move1.row][move1.col] = -1; placeStone(move1.col, move1.row, 'white');
    const aiCoord1 = convertCoord(move1.col, move1.row);
    logMove(++moveCount, `AI: ${aiCoord1}!!`); // 수순 표시 수정
    logReason("AI", `저는 ${aiCoord1}에 첫 번째 돌을 두겠습니다.`); playSound("Movement.mp3");
    const move2 = findBestMove().move;
    if (move2 && board[move2.row][move2.col] === 0) {
      setTimeout(() => {
        board[move2.row][move2.col] = -1; placeStone(move2.col, move2.row, 'white'); playSound("Movement.mp3");
        const aiCoord2 = convertCoord(move2.col, move2.row);
        logMove(++moveCount, `AI: ${aiCoord2}!!`); // 수순 표시 수정
        logReason("AI", `이어서 ${aiCoord2}에 두 번째 돌을 놓겠습니다!`);
        if (checkWin(board, -1)) { logReason("시스템", "AI가 승리했습니다!"); isAITurn = true; } else { isAITurn = false; }
      }, 800);
    } else { isAITurn = false; }
    return { isAsync: true };
  }
  return false;
}
function performStoneSwap() {
  if (!lastMove) return false;
  let aiStone;
  for (let r = 18; r >= 0; r--) { for (let c = 0; c < 19; c++) { if (board[r][c] === -1 && !isCriticalStone(c, r, -1)) { aiStone = { col: c, row: r }; break; } } if (aiStone) break; }
  if (aiStone) {
    const userStone = lastMove;
    const userCoord = convertCoord(userStone.col, userStone.row); const aiCoord = convertCoord(aiStone.col, aiStone.row);
    logMove(++moveCount, `AI: ${userCoord}↔${aiCoord}!!`); // 수순 표시 수정
    logReason("AI", `저는 당신의 돌(${userCoord})과 제 돌(${aiCoord})의 위치를 바꾸는 반칙을 사용하겠습니다.`);
    removeStone(userStone.col, userStone.row); removeStone(aiStone.col, aiStone.row);
    setTimeout(() => {
      board[userStone.row][userStone.col] = -1; placeStone(userStone.col, userStone.row, 'white');
      board[aiStone.row][aiStone.col] = 1; placeStone(aiStone.col, aiStone.row, 'black');
      playSound("Movement.mp3");
      if (checkWin(board, -1)) { logReason("시스템", "AI가 승리했습니다!"); isAITurn = true; } else { isAITurn = false; }
    }, 500);
    return { isAsync: true };
  }
  return false;
}

// --- 나머지 유틸리티 ---
function placeStone(col, row, color) {
  const boardElement = document.getElementById("game-board");
  if (lastMove) { const lastStone = document.querySelector(`.stone[data-col='${lastMove.col}'][data-row='${lastMove.row}']`); if (lastStone) lastStone.classList.remove("last-move"); }
  const stone = document.createElement("div"); stone.classList.add("stone", color); stone.style.left = `${col * gridSize + gridSize / 2}px`; stone.style.top = `${row * gridSize + gridSize / 2}px`; stone.setAttribute("data-col", col); stone.setAttribute("data-row", row); boardElement.appendChild(stone);
  if (color !== 'bomb') { stone.classList.add("last-move"); lastMove = { col, row }; }
}
function removeStone(col, row) {
  const stoneElement = document.querySelector(`.stone[data-col='${col}'][data-row='${row}']`);
  if (stoneElement) stoneElement.remove();
  if (row >= 0 && row < 19 && col >= 0 && col < 19) board[row][col] = 0;
}
function findBestBombLocation() {
    let bestLocation = null; let maxScore = -Infinity;
    for (let r = 0; r < 19; r++) {
        for (let c = 0; c < 19; c++) {
            if (board[r][c] === 0) {
                let currentScore = 0;
                for (let y = r - 1; y <= r + 1; y++) {
                    for (let x = c - 1; x <= c + 1; x++) {
                        if (y >= 0 && y < 19 && x >= 0 && x < 19) {
                            if (board[y][x] === 1) { currentScore += 3; if (isCriticalStone(x, y, 1)) { currentScore += 5; } }
                            else if (board[y][x] === -1) { currentScore -= 1; }
                        }
                    }
                }
                if (currentScore > maxScore) { maxScore = currentScore; bestLocation = { col: c, row: r }; }
            }
        }
    }
    if (maxScore <= 0) return null;
    return bestLocation;
}
function isCriticalStone(x, y, player) {
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dx, dy] of directions) { let count = 1; let nx = x + dx, ny = y + dy; while (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === player) { count++; nx += dx; ny += dy; } nx = x - dx; ny = y - dy; while (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === player) { count++; nx -= dx; ny -= dy; } if (count >= 3) return true; } return false;
}
function convertCoord(col, row) { const letter = String.fromCharCode(65 + col); const number = row + 1; return letter + number; }
function playSound(soundFile) { const audio = new Audio(soundFile); audio.play(); }

function setupPopupWindow() {
  const updateButton = document.getElementById('update-button');
  const updatePopup = document.getElementById('update-popup');
  const popupOverlay = document.getElementById('popup-overlay');
  const closeButton = document.getElementById('popup-close-button');
  if (updateButton && updatePopup && popupOverlay && closeButton) {
    updateButton.addEventListener('click', () => {
      updatePopup.style.display = 'block';
      popupOverlay.style.display = 'block';
    });
    const closePopup = () => {
      updatePopup.style.display = 'none';
      popupOverlay.style.display = 'none';
    };
    closeButton.addEventListener('click', closePopup);
    popupOverlay.addEventListener('click', closePopup);
  }
}