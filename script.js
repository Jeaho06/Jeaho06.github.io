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
  const moveLog = document.getElementById("move-log");
  if (!moveLog) return;
  const messageElem = document.createElement("p");
  messageElem.innerHTML = message;
  moveLog.appendChild(messageElem);
  moveLog.scrollTop = moveLog.scrollHeight;
}

function logReason(sender, message) {
  const reasonLog = document.getElementById("reasoning-log");
  if (!reasonLog) return;
  const messageElem = document.createElement("p");
  messageElem.textContent = `${sender}: ${message}`;
  reasonLog.appendChild(messageElem);
  reasonLog.scrollTop = reasonLog.scrollHeight;
}

// --- 핵심 로직 ---
function createBoard() {
  const boardElement = document.getElementById("game-board");
  if (!boardElement) return;

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
    const rect = boardElement.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const closestX = Math.round((offsetX - gridSize / 2) / gridSize);
    const closestY = Math.round((offsetY - gridSize / 2) / gridSize);
    if (closestX < 0 || closestX >= 19 || closestY < 0 || closestY >= 19 || board[closestY][closestX] !== 0) return;
    if (isForbiddenMove(closestX, closestY, 1)) {
      logReason("시스템", "금수입니다! 다른 위치를 선택하세요.");
      return;
    }
    board[closestY][closestX] = 1;
    placeStone(closestX, closestY, 'black');
    playSound("Movement.mp3");
    const userCoord = convertCoord(closestX, closestY);
    logMove(`사용자: ${userCoord}??`);
    if (checkWin(board, 1)) {
      logReason("시스템", "사용자가 승리했습니다!");
      isAITurn = true;
      return;
    }
    isAITurn = true;
    setTimeout(aiMove, 1500); // AI 반응 속도 소폭 상승
  });
}

function aiMove() {
  if (bombState.isArmed) {
    detonateBomb();
    return;
  }
  let moveAction = null;
  const winMove = findWinMove(-1);
  if (winMove) {
    moveAction = () => performNormalMove(winMove);
  } else {
    const willCheat = Math.random() < cheatProbability && !isFirstMove && lastMove;
    if (willCheat) {
      const cheatRoll = Math.random();
      if (cheatRoll < 0.1) {
        moveAction = () => placeBomb();
      } else {
        const otherCheats = [() => performDoubleMove(), () => performStoneSwap()];
        moveAction = otherCheats[Math.floor(Math.random() * otherCheats.length)];
      }
    } else {
      moveAction = () => performNormalMove();
    }
  }
  const actionResult = moveAction();
  if (actionResult && actionResult.isAsync === false) {
    if (checkWin(board, -1)) {
      logReason("시스템", "AI가 승리했습니다!");
      isAITurn = true;
    } else {
      isAITurn = false;
    }
  }
}

// --- 지능형 로직 (대폭 수정) ---

/**
 * AI의 두뇌: 의사결정의 우선순위를 정의합니다.
 */
function chooseAiMove() {
  // 1순위: AI가 두면 즉시 이기는 곳
  let move = findWinMove(-1);
  if (move) return { move: move, reason: "승리하기 위해" };

  // 2순위: 사용자가 다음 수에 이기는 곳을 방어
  move = findWinMove(1);
  if (move) return { move: move, reason: "당신의 승리를 막기 위해" };

  // 3순위: AI가 '열린 4' 또는 '열린 3'을 만들 수 있는 공격적인 수
  move = findThreatLocation(-1, 4);
  if (move) return { move: move, reason: "필승 패턴을 만들기 위해" };
  move = findThreatLocation(-1, 3);
  if (move) return { move: move, reason: "강력한 공격을 준비하기 위해" };

  // 4순위: 사용자의 '열린 3' 등 강력한 공격을 미리 방어
  move = findThreatLocation(1, 3);
  if (move) return { move: move, reason: "당신의 공격을 미리 차단하기 위해" };
  
  // 5순위: 위의 상황이 없다면 일반적인 최적의 위치를 찾음
  const fallbackMove = lastMove ? findNearMove(lastMove.col, lastMove.row) : findCenterMove();
  if (fallbackMove) { return { move: fallbackMove, reason: "당신을 압박하기 위해" }; }

  return { move: findCenterMove(), reason: "둘 곳이 마땅치 않아 중앙에" };
}

/**
 * 특정 패턴(위협)을 탐지하여 최적의 공격/방어 위치를 찾는 함수
 * @param {number} player - 탐지할 대상 플레이어 (1: 사용자, -1: AI)
 * @param {number} length - 찾고자 하는 연속된 돌의 길이 (3 또는 4)
 * @returns {object|null} - 최적의 위치 또는 null
 */
function findThreatLocation(player, length) {
  const opponent = -player;
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  
  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < 19; x++) {
      if (board[y][x] !== 0) continue; // 빈칸만 검사

      // 내가 이 위치에 두었을 때의 상황을 가정
      board[y][x] = player;
      let wins = checkWin(board, player);
      board[y][x] = 0; // 가정했던 수 되돌리기
      if (wins && length === 5) return { col: x, row: y }; // 5목 완성 지점

      // 상대방이 이 위치에 두었을 때의 상황을 가정
      board[y][x] = opponent;
      let loses = checkWin(board, opponent);
      board[y][x] = 0; // 가정했던 수 되돌리기
      if (loses) continue; // 상대가 두면 이기는 곳은 피함

      for (const [dx, dy] of directions) {
        let patternInfo = getPatternInfo(x, y, player, dx, dy);
        // '열린 3' 또는 '열린 4' 패턴을 찾음
        if (patternInfo.count === length && patternInfo.openEnds === 2) {
          return { col: x, row: y };
        }
      }
    }
  }
  return null;
}

/**
 * 특정 위치와 방향에 대해 연속된 돌의 개수와 열린 상태를 반환하는 헬퍼 함수
 */
function getPatternInfo(x, y, player, dx, dy) {
  let count = 1;
  let openEnds = 0;

  // 정방향 탐색
  for (let i = 1; i < 5; i++) {
    const nx = x + i * dx;
    const ny = y + i * dy;
    if (nx < 0 || ny < 0 || nx >= 19 || ny >= 19 || board[ny][nx] !== player) {
      if (nx >= 0 && ny >= 0 && nx < 19 && ny < 19 && board[ny][nx] === 0) {
        openEnds++;
      }
      break;
    }
    count++;
  }

  // 역방향 탐색
  for (let i = 1; i < 5; i++) {
    const nx = x - i * dx;
    const ny = y - i * dy;
    if (nx < 0 || ny < 0 || nx >= 19 || ny >= 19 || board[ny][nx] !== player) {
      if (nx >= 0 && ny >= 0 && nx < 19 && ny < 19 && board[ny][nx] === 0) {
        openEnds++;
      }
      break;
    }
    count++;
  }
  return { count, openEnds };
}


// --- 이하 행동 함수 및 유틸리티 (기존과 거의 동일) ---
function performNormalMove(move = null) {
  let reason = "";
  if (move) {
    reason = "이 수로 이기기 위해";
  } else {
    const aiDecision = chooseAiMove();
    move = aiDecision.move;
    reason = aiDecision.reason;
  }
  if (move && board[move.row][move.col] === 0) {
    board[move.row][move.col] = -1;
    placeStone(move.col, move.row, 'white');
    playSound("Movement.mp3");
    const aiCoord = convertCoord(move.col, move.row);
    logMove(`AI: ${aiCoord}`);
    logReason("AI", `저는 ${aiCoord}에 ${reason} 돌을 두겠습니다.`);
    isFirstMove = false;
    return { isAsync: false };
  }
  return false;
}

function findWinMove(player) {
  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < 19; x++) {
      if (board[y][x] === 0) {
        board[y][x] = player;
        if (checkWin(board, player)) {
          board[y][x] = 0;
          return { col: x, row: y };
        }
        board[y][x] = 0;
      }
    }
  }
  return null;
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
            } else {
              break;
            }
          }
          if (count >= 5) return true; // 6목, 7목 등도 승리로 인정 (간소화)
        }
      }
    }
  }
  return false;
}
// (이하 반칙 함수, 유틸리티 함수 등 기존 코드와 동일)
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
  const aiDecision1 = chooseAiMove();
  const move1 = aiDecision1.move;

  if (move1 && board[move1.row][move1.col] === 0) {
    board[move1.row][move1.col] = -1;
    placeStone(move1.col, move1.row, 'white');
    const aiCoord1 = convertCoord(move1.col, move1.row);
    logMove(`AI: ${aiCoord1}!!`);
    logReason("AI", `저는 ${aiCoord1}에 ${aiDecision1.reason} 첫 번째 돌을 두겠습니다.`);
    playSound("Movement.mp3");

    const aiDecision2 = chooseAiMove();
    const move2 = aiDecision2.move;

    if (move2 && board[move2.row][move2.col] === 0) {
      setTimeout(() => {
        board[move2.row][move2.col] = -1;
        placeStone(move2.col, move2.row, 'white');
        playSound("Movement.mp3");
        const aiCoord2 = convertCoord(move2.col, move2.row);
        logMove(`AI: ${aiCoord2}!!`);
        logReason("AI", `이어서 ${aiCoord2}에 ${aiDecision2.reason} 두 번째 돌을 놓겠습니다.`);
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
function isForbiddenMove(x, y, player) {
  board[y][x] = player;
  let openThrees = 0;
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dx, dy] of directions) {
    if (getPatternInfo(x, y, player, dx, dy).count === 3 && getPatternInfo(x, y, player, dx, dy).openEnds === 2) {
      openThrees++;
    }
  }
  board[y][x] = 0;
  return openThrees >= 2;
}
function convertCoord(col, row) { const letter = String.fromCharCode(65 + col); const number = row + 1; return letter + number; }
function playSound(soundFile) { const audio = new Audio(soundFile); audio.play(); }