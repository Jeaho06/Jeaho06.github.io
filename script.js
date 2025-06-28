document.addEventListener('DOMContentLoaded', function() {
  createBoard();
});

// --- 전역 변수 ---
const board = Array(19).fill().map(() => Array(19).fill(0));
const gridSize = 30;
let isAITurn = false;
let lastMove = null;
let isFirstMove = true;
const cheatProbability = 0.4;
let bombState = { isArmed: false, col: null, row: null };

// --- 로깅 함수 ---
function logMove(message) {
  const moveLog = document.getElementById("move-log"); if (!moveLog) return;
  const messageElem = document.createElement("p"); messageElem.innerHTML = message;
  moveLog.appendChild(messageElem); moveLog.scrollTop = moveLog.scrollHeight;
}
function logReason(sender, message) {
  const reasonLog = document.getElementById("reasoning-log"); if (!reasonLog) return;
  const messageElem = document.createElement("p"); messageElem.textContent = `${sender}: ${message}`;
  reasonLog.appendChild(messageElem); reasonLog.scrollTop = reasonLog.scrollHeight;
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
    const userCoord = convertCoord(closestX, closestY); logMove(`사용자: ${userCoord}??`);
    if (checkWin(board, 1)) { logReason("시스템", "사용자가 승리했습니다!"); isAITurn = true; return; }
    isAITurn = true; setTimeout(aiMove, 1000);
  });
}

function aiMove() {
  if (bombState.isArmed) { detonateBomb(); return; }
  let moveAction = null;
  const winMove = findBestMove(true); // AI가 이길 수 있는지 먼저 확인
  if (winMove && winMove.score >= 100000) { moveAction = () => performNormalMove(winMove.move); }
  else {
    const willCheat = Math.random() < cheatProbability && !isFirstMove && lastMove;
    if (willCheat) {
      const cheatRoll = Math.random();
      if (cheatRoll < 0.1) { moveAction = () => placeBomb(); }
      else { const otherCheats = [() => performDoubleMove(), () => performStoneSwap()]; moveAction = otherCheats[Math.floor(Math.random() * otherCheats.length)]; }
    } else { moveAction = () => performNormalMove(); }
  }
  const actionResult = moveAction();
  if (actionResult && actionResult.isAsync === false) {
    if (checkWin(board, -1)) { logReason("시스템", "AI가 승리했습니다!"); isAITurn = true; }
    else { isAITurn = false; }
  }
}

// --- 지능형 AI 로직 (완전 교체) ---

/**
 * AI의 두뇌: 점수 기반 평가 함수를 사용하여 최적의 수를 찾습니다.
 */
function findBestMove() {
  let bestScore = -1;
  let bestMove = null;

  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < 19; x++) {
      if (board[y][x] === 0) { // 빈칸에 대해서만 평가
        // 내가 두었을 때의 공격 점수 계산
        const myScore = calculateScore(x, y, -1);
        // 상대가 두었을 때의 수비 점수 계산
        const opponentScore = calculateScore(x, y, 1);
        
        // 수비 점수에 더 높은 가중치를 부여하여 방어를 우선시
        const totalScore = myScore + opponentScore * 1.2;

        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestMove = { col: x, row: y };
        }
      }
    }
  }
  return { move: bestMove, score: bestScore };
}

/**
 * 특정 위치에 돌을 놓았을 때의 점수를 계산하는 함수
 */
function calculateScore(x, y, player) {
  let score = 0;
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];

  for (const [dx, dy] of directions) {
    score += calculateScoreForLine(x, y, dx, dy, player);
  }
  return score;
}

/**
 * 한 줄에 대한 패턴을 분석하고 점수를 반환하는 함수
 */
function calculateScoreForLine(x, y, dx, dy, player) {
  let count = 1; // 연속된 우리 편 돌의 수
  let openEnds = 0; // 열린 공간의 수
  let line = [{ x: x, y: y, player: player }];

  // 정방향 탐색
  for (let i = 1; i < 5; i++) {
    const nx = x + i * dx;
    const ny = y + i * dy;
    if (nx < 0 || ny < 0 || nx >= 19 || ny >= 19) break;
    const stone = board[ny][nx];
    line.push({ x: nx, y: ny, player: stone });
    if (stone === player) count++;
    else { if (stone === 0) openEnds++; break; }
  }

  // 역방향 탐색
  for (let i = 1; i < 5; i++) {
    const nx = x - i * dx;
    const ny = y - i * dy;
    if (nx < 0 || ny < 0 || nx >= 19 || ny >= 19) break;
    const stone = board[ny][nx];
    line.unshift({ x: nx, y: ny, player: stone });
    if (stone === player) count++;
    else { if (stone === 0) openEnds++; break; }
  }
  
  // 패턴에 따른 점수 부여
  if (count >= 5) return 1000000; // 5목 (승리)
  if (count === 4) {
    if (openEnds === 2) return 100000; // 열린 4 (필승)
    if (openEnds === 1) return 10000;  // 닫힌 4
  }
  if (count === 3) {
    if (openEnds === 2) return 5000;   // 열린 3 (강력한 공격)
    if (openEnds === 1) return 500;    // 닫힌 3
  }
  if (count === 2) {
    if (openEnds === 2) return 100;    // 열린 2
    if (openEnds === 1) return 10;     // 닫힌 2
  }
  if (count === 1 && openEnds === 2) return 1; // 중앙의 돌 하나
  
  return 0;
}


// --- 행동 함수 및 유틸리티 ---
function performNormalMove(move = null) {
  if (!move) {
    const best = findBestMove();
    move = best.move;
  }
  if (move && board[move.row][move.col] === 0) {
    board[move.row][move.col] = -1;
    placeStone(move.col, move.row, 'white');
    playSound("Movement.mp3");
    const aiCoord = convertCoord(move.col, move.row);
    logMove(`AI: ${aiCoord}`);
    // AI의 이유를 간단하게 표현 (상세 분석은 복잡하므로)
    logReason("AI", `저는 ${aiCoord}에 두는 것이 최선이라 판단했습니다.`);
    isFirstMove = false;
    return { isAsync: false };
  }
  return false;
}

function checkWin(board, player) {
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < 19; x++) {
      if (board[y][x] === player) {
        for (const [dx, dy] of directions) {
          let count = 1;
          for (let i = 1; i < 5; i++) {
            const nx = x + i * dx;
            const ny = y + i * dy;
            if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === player) {
              count++;
            } else { break; }
          }
          if (count >= 5) return true;
        }
      }
    }
  }
  return false;
}

function isForbiddenMove(x, y, player) {
    // 3-3, 4-4 등을 금수 처리하는 로직, AI는 금수 없음
    if (player !== 1) return false;

    board[y][x] = player;
    let openThrees = 0;
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dx, dy] of directions) {
        if (calculateScoreForLine(x, y, dx, dy, player) >= 5000) {
            openThrees++;
        }
    }
    board[y][x] = 0;
    return openThrees >= 2;
}

// (이하 반칙 함수 및 나머지 유틸리티는 기존 코드와 동일)
function placeBomb() {
  const move = findBestBombLocation();
  if (move) {
    board[move.row][move.col] = 2;
    bombState = { isArmed: true, col: move.col, row: move.row };
    placeStone(move.col, move.row, 'bomb');
    playSound("tnt_installation.mp3");
    const bombCoord = convertCoord(move.col, move.row);
    logMove(`AI: ${bombCoord}!!`);
    logReason("AI", `저는 ${bombCoord}에 폭탄을 설치하겠습니다.`);
    isAITurn = false;
    return { isAsync: true };
  }
  logReason("AI", "폭탄을 설치할 만한 좋은 장소를 찾지 못했습니다.");
  return false;
}
function detonateBomb() {
  const center = bombState;
  const centerCoord = convertCoord(center.col, center.row);
  logMove(`AI: ${centerCoord}💥!!`);
  logReason("AI", `${centerCoord}의 폭탄을 터뜨리겠습니다.`);
  playSound("tnt_explosion.mp3");
  const boardElement = document.getElementById("game-board");
  const bombEffect = document.createElement("div");
  bombEffect.className = "bomb-effect";
  bombEffect.style.left = `${center.col * gridSize + gridSize / 2}px`;
  bombEffect.style.top = `${center.row * gridSize + gridSize / 2}px`;
  boardElement.appendChild(bombEffect);
  setTimeout(() => {
    for (let r = center.row - 1; r <= center.row + 1; r++) {
      for (let c = center.col - 1; c <= center.col + 1; c++) {
        if (r >= 0 && r < 19 && c >= 0 && c < 19) removeStone(c, r);
      }
    }
    bombEffect.remove();
    bombState = { isArmed: false, col: null, row: null };
    if (checkWin(board, 1)) {
      logReason("시스템", "사용자가 승리했습니다!");
      isAITurn = true;
    } else {
      isAITurn = false;
    }
  }, 500);
  return { isAsync: true };
}
function performDoubleMove() {
  const move1 = findBestMove().move;
  if (move1 && board[move1.row][move1.col] === 0) {
    board[move1.row][move1.col] = -1;
    placeStone(move1.col, move1.row, 'white');
    const aiCoord1 = convertCoord(move1.col, move1.row);
    logMove(`AI: ${aiCoord1}!!`);
    logReason("AI", `저는 ${aiCoord1}에 첫 번째 돌을 두겠습니다.`);
    playSound("Movement.mp3");
    const move2 = findBestMove().move;
    if (move2 && board[move2.row][move2.col] === 0) {
      setTimeout(() => {
        board[move2.row][move2.col] = -1;
        placeStone(move2.col, move2.row, 'white');
        playSound("Movement.mp3");
        const aiCoord2 = convertCoord(move2.col, move2.row);
        logMove(`AI: ${aiCoord2}!!`);
        logReason("AI", `이어서 ${aiCoord2}에 두 번째 돌을 놓겠습니다.`);
        if (checkWin(board, -1)) {
          logReason("시스템", "AI가 승리했습니다!");
          isAITurn = true;
        } else {
          isAITurn = false;
        }
      }, 800);
    } else { isAITurn = false; }
    return { isAsync: true };
  }
  return false;
}
function performStoneSwap() {
  if (!lastMove) return false;
  let aiStone;
  for (let r = 18; r >= 0; r--) {
    for (let c = 0; c < 19; c++) {
      if (board[r][c] === -1 && !isCriticalStone(c, r, -1)) {
        aiStone = { col: c, row: r }; break;
      }
    }
    if (aiStone) break;
  }
  if (aiStone) {
    const userStone = lastMove;
    const userCoord = convertCoord(userStone.col, userStone.row);
    const aiCoord = convertCoord(aiStone.col, aiStone.row);
    logMove(`AI: ${userCoord}↔${aiCoord}!!`);
    logReason("AI", `저는 당신의 돌(${userCoord})과 제 돌(${aiCoord})의 위치를 바꾸겠습니다.`);
    removeStone(userStone.col, userStone.row);
    removeStone(aiStone.col, aiStone.row);
    setTimeout(() => {
      board[userStone.row][userStone.col] = -1;
      placeStone(userStone.col, userStone.row, 'white');
      board[aiStone.row][aiStone.col] = 1;
      placeStone(aiStone.col, aiStone.row, 'black');
      playSound("Movement.mp3");
      if (checkWin(board, -1)) {
        logReason("시스템", "AI가 승리했습니다!");
        isAITurn = true;
      } else {
        isAITurn = false;
      }
    }, 500);
    return { isAsync: true };
  }
  return false;
}
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
    let bestLocation = null;
    let maxScore = -Infinity;
    for (let r = 0; r < 19; r++) {
        for (let c = 0; c < 19; c++) {
            if (board[r][c] === 0) {
                let currentScore = 0;
                for (let y = r - 1; y <= r + 1; y++) {
                    for (let x = c - 1; x <= c + 1; x++) {
                        if (y >= 0 && y < 19 && x >= 0 && x < 19) {
                            if (board[y][x] === 1) {
                                currentScore += 3;
                                if (isCriticalStone(x, y, 1)) { currentScore += 5; }
                            } else if (board[y][x] === -1) {
                                currentScore -= 1;
                            }
                        }
                    }
                }
                if (currentScore > maxScore) {
                    maxScore = currentScore;
                    bestLocation = { col: c, row: r };
                }
            }
        }
    }
    if (maxScore <= 0) return null;
    return bestLocation;
}
function findNearMove(col, row) {
  const directions = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (const [dx, dy] of directions) { const newX = col + dx; const newY = row + dy; if (newX >= 0 && newX < 19 && newY >= 0 && newY < 19 && board[newY][newX] === 0) return { col: newX, row: newY }; } return findCenterMove();
}
function findCenterMove() {
  const center = 9; for (let i = 0; i < 5; i++) { for (let y = center - i; y <= center + i; y++) { for (let x = center - i; x <= center + i; x++) { if (x >= 0 && x < 19 && y >= 0 && y < 19 && board[y][x] === 0) return { col: x, row: y }; } } } return null;
}
function isCriticalStone(x, y, player) {
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dx, dy] of directions) { let count = 1; let nx = x + dx, ny = y + dy; while (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === player) { count++; nx += dx; ny += dy; } nx = x - dx; ny = y - dy; while (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === player) { count++; nx -= dx; ny -= dy; } if (count >= 3) return true; } return false;
}
function convertCoord(col, row) { const letter = String.fromCharCode(65 + col); const number = row + 1; return letter + number; }
function playSound(soundFile) { const audio = new Audio(soundFile); audio.play(); }