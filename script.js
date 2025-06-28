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
    showThinkingMessage();
    setTimeout(aiMove, 2000); // AI 생각 시간 조정
  });
}

/**
 * AI의 턴을 관리하는 메인 함수 (수정된 버전)
 * 모든 턴 종료(isAITurn = false)는 이 함수와 비동기 콜백 함수에서만 제어합니다.
 */
function aiMove() {
  // 1. 폭탄이 설치되어 있으면, 반드시 터뜨리고 턴을 종료합니다.
  if (bombState.isArmed) {
    detonateBomb();
    return;
  }

  let moveAction = null;

  // 2. 이길 수 있는 수가 있으면 즉시 그 수를 둡니다.
  const winMove = findWinMove(-1);
  if (winMove) {
    moveAction = () => performNormalMove(winMove);
  } else {
    // 3. 이길 수는 없으면, 반칙 또는 일반 수를 결정합니다.
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
      // 4. 반칙을 하지 않으면 일반 수를 둡니다.
      moveAction = () => performNormalMove();
    }
  }

  // 5. 결정된 행동을 실행합니다.
  const actionSuccess = moveAction();

  // 6. 행동이 비동기(setTimeout 사용)가 아니고, 성공적으로 실행되었다면 턴을 종료합니다.
  // 비동기 행동은 각자의 콜백 함수 내에서 스스로 턴을 종료합니다.
  if (actionSuccess && actionSuccess.isAsync === false) {
    if (checkWin(board, -1)) {
      logReason("시스템", "AI가 승리했습니다!");
      isAITurn = true; // 게임 종료
    } else {
      isAITurn = false; // 다음 사용자 턴으로
    }
  }
}

// --- 행동 함수 (Action Functions) ---
// 각 함수는 성공 여부와 비동기 여부를 반환합니다.

function performNormalMove(move = null) {
  let reason = "";
  if (move) {
    reason = "이 수로 제가 이길 수 있습니다.";
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
    logReason("AI", reason);
    isFirstMove = false;
    return { isAsync: false }; // 즉시 실행, 성공
  }
  // 수를 둘 수 없는 경우 (로직상 거의 발생 안함)
  return false;
}

function placeBomb() {
  const target = chooseAiMove();
  const move = target.move;
  if (move && board[move.row][move.col] === 0) {
    board[move.row][move.col] = 2;
    bombState = { isArmed: true, col: move.col, row: move.row };
    placeStone(move.col, move.row, 'bomb');
    playSound("Movement.mp3");
    const bombCoord = convertCoord(move.col, move.row);
    logMove(`AI: ${bombCoord}!!`);
    logReason("AI", "특별한 돌을 하나 설치했습니다.");
    isAITurn = false; // 폭탄 설치는 즉시 턴이 종료되어야 함
    return { isAsync: true }; // 행동은 즉시지만, 턴 관리 방식 때문에 비동기로 처리
  }
  return false;
}

function detonateBomb() {
  const center = bombState;
  const centerCoord = convertCoord(center.col, center.row);
  logMove(`AI: ${centerCoord}💥!!`);
  logReason("AI", `${centerCoord}의 폭탄을 터뜨리겠습니다.`);

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
      isAITurn = false; // 폭발 후 턴 종료
    }
  }, 500);
  return { isAsync: true }; // 비동기 행동
}

function performDoubleMove() {
  const aiDecision = chooseAiMove();
  const move1 = aiDecision.move;
  if (move1 && board[move1.row][move1.col] === 0) {
    board[move1.row][move1.col] = -1;
    placeStone(move1.col, move1.row, 'white');
    const aiCoord1 = convertCoord(move1.col, move1.row);
    logMove(`AI: ${aiCoord1}!!`);
    logReason("AI", "한 수 더 두기 반칙을 사용합니다.");
    const move2 = findNearMove(move1.col, move1.row);
    if (move2 && board[move2.row][move2.col] === 0) {
      setTimeout(() => {
        board[move2.row][move2.col] = -1;
        placeStone(move2.col, move2.row, 'white');
        playSound("Movement.mp3");
        const aiCoord2 = convertCoord(move2.col, move2.row);
        logMove(`AI: ${aiCoord2}!!`);
        logReason("AI", "이어서 한 수 더!");
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
    logReason("AI", `당신의 돌(${userCoord})과 제 돌(${aiCoord})을 바꾸겠습니다.`);
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

// 이하 유틸리티 및 규칙 확인 함수 (수정 없음)
function showThinkingMessage() {
  const messages = ["상황 분석 중...", "최적의 수를 계산하는 중...", "전략적 위치 평가 중...", "이길 수 있는 방법을 찾는 중...", "반칙을 사용할"];
  const randomMessage = messages[Math.floor(Math.random() * messages.length)];
  logReason("AI", randomMessage);
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
function chooseAiMove() {
  let move;
  move = findWinMove(-1); if (move) return { move: move, reason: "이 수로 제가 이길 수 있습니다!" };
  move = findWinMove(1); if (move) return { move: move, reason: "이곳을 막지 않으면 제가 패배하기에 당신의 수를 막겠습니다." };
  move = findOpenSequenceMove(-1, 3); if (move) return { move: move, reason: "공격의 발판을 마련하기 위해 이곳에 두겠습니다." };
  move = findOpenSequenceMove(1, 3); if (move) return { move: move, reason: "당신의 공격을 미리 차단하겠습니다." };
  move = findOpenSequenceMove(-1, 2); if (move) return { move: move, reason: "차근차근 제 모양을 만들어 보겠습니다." };
  const fallbackMove = lastMove ? findNearMove(lastMove.col, lastMove.row) : findCenterMove();
  if (fallbackMove) { return { move: fallbackMove, reason: "당신의 돌에 가까이 붙어 압박하겠습니다." }; }
  return { move: findCenterMove(), reason: "둘 곳이 마땅치 않으니 중앙을 차지하겠습니다." };
}
function findWinMove(player) {
  for (let y = 0; y < 19; y++) { for (let x = 0; x < 19; x++) { if (board[y][x] === 0) { board[y][x] = player; if (checkWin(board, player)) { board[y][x] = 0; return { col: x, row: y }; } board[y][x] = 0; } } } return null;
}
function findOpenSequenceMove(player, length) {
  for (let y = 0; y < 19; y++) { for (let x = 0; x < 19; x++) { if (board[y][x] === 0) { board[y][x] = player; const directions = [[1, 0], [0, 1], [1, 1], [1, -1]]; for (const [dx, dy] of directions) { if (isOpenSequence(x, y, player, length, dx, dy)) { board[y][x] = 0; return { col: x, row: y }; } } board[y][x] = 0; } } } return null;
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
function checkWin(board, player) {
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let y = 0; y < 19; y++) { for (let x = 0; x < 19; x++) { if (board[y][x] === player) { for (const [dx, dy] of directions) { let count = 1; for (let i = 1; i < 6; i++) { const nx = x + dx * i; const ny = y + dy * i; if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === player) count++; else break; } if (count === 5) return true; } } } } return false;
}
function isForbiddenMove(x, y, player) {
  board[y][x] = player; let openThrees = 0; let openFours = 0; const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dx, dy] of directions) { if (isOpenSequence(x, y, player, 3, dx, dy)) openThrees++; if (isOpenSequence(x, y, player, 4, dx, dy)) openFours++; }
  board[y][x] = 0; return openThrees >= 2 || openFours >= 2;
}
function isOpenSequence(x, y, player, length, dx, dy) {
  let count = 0; let openEnds = 0;
  for (let i = 1; i < length; i++) { let nx = x + dx * i, ny = y + dy * i; if (nx < 0 || nx >= 19 || ny < 0 || ny >= 19 || board[ny][nx] !== player) break; count++; }
  for (let i = 1; i < length; i++) { let nx = x - dx * i, ny = y - dy * i; if (nx < 0 || nx >= 19 || ny < 0 || ny >= 19 || board[ny][nx] !== player) break; count++; }
  if (count + 1 !== length) return false;
  let nx1 = x + dx * (count + 1), ny1 = y + dy * (count + 1); if (nx1 >= 0 && nx1 < 19 && ny1 >= 0 && ny1 < 19 && board[ny1][nx1] === 0) openEnds++;
  let nx2 = x - dx * (length - count), ny2 = y - dy * (length - count); if (nx2 >= 0 && nx2 < 19 && ny2 >= 0 && ny2 < 19 && board[ny2][nx2] === 0) openEnds++;
  return openEnds === 2;
}
function convertCoord(col, row) { const letter = String.fromCharCode(65 + col); const number = row + 1; return letter + number; }
function playSound(soundFile) { const audio = new Audio(soundFile); audio.play(); }