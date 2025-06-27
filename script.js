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

// 새로운 폭탄 상태 관리 변수
// board 값: 0(빈칸), 1(사용자), -1(AI), 2(폭탄)
let bombState = {
  isArmed: false,
  col: null,
  row: null
};


// --- 핵심 로직 ---

function createBoard() {
  const boardElement = document.getElementById("game-board");
  if (!boardElement) {
    console.error("오목판을 찾을 수 없습니다.");
    return;
  }
  // (이하 보드 생성 로직은 동일하므로 생략)
  // 바둑판 줄 생성
  for (let i = 0; i < 19; i++) {
    const lineH = document.createElement("div");
    lineH.classList.add("line", "horizontal-line");
    lineH.style.top = `${i * gridSize + gridSize/2}px`;
    boardElement.appendChild(lineH);

    const lineV = document.createElement("div");
    lineV.classList.add("line", "vertical-line");
    lineV.style.left = `${i * gridSize + gridSize/2}px`;
    boardElement.appendChild(lineV);
  }

  // 좌표 라벨 생성
  for (let i = 0; i < 19; i++) {
    const colLabel = document.createElement("div");
    colLabel.className = "coordinate-label top-label";
    colLabel.style.left = `${i * gridSize + gridSize/2}px`;
    colLabel.textContent = String.fromCharCode(65 + i);
    boardElement.appendChild(colLabel);

    const rowLabel = document.createElement("div");
    rowLabel.className = "coordinate-label left-label";
    rowLabel.style.top = `${i * gridSize + gridSize/2}px`;
    rowLabel.textContent = i + 1;
    boardElement.appendChild(rowLabel);
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
      chat("시스템", "금수입니다! 다른 위치를 선택하세요.");
      return;
    }
    board[closestY][closestX] = 1;
    placeStone(closestX, closestY, 'black');
    playSound("Movement.mp3");
    const userCoord = convertCoord(closestX, closestY);
    chat("사용자", `${userCoord}?`);
    if (checkWin(board, 1)) {
      chat("시스템", "사용자가 승리했습니다!");
      isAITurn = true;
      return;
    }
    isAITurn = true;
    showThinkingMessage();
    setTimeout(aiMove, 3000);
  });
}

/**
 * AI의 턴을 관리하는 메인 함수
 * 1. 설치된 폭탄이 있으면 터뜨림 (최우선)
 * 2. 이길 수 있는 수가 있으면 즉시 둠
 * 3. 일정 확률로 반칙 또는 일반 수를 둠
 */
function aiMove() {
    // [최우선] 설치된 폭탄이 있는지 확인
    if (bombState.isArmed) {
        detonateBomb(); // detonateBomb 함수가 스스로 턴을 종료하므로 여기서 return
        return;
    }

    // 이길 수 있는 수가 있는지 확인
    const winMove = findWinMove(-1);
    if (winMove) {
        performNormalMove(winMove);
        isAITurn = false; // 즉시 실행되는 행동이므로 aiMove에서 턴 종료
        return;
    }
    
    // 반칙을 시도할지 결정
    const willCheat = Math.random() < cheatProbability && !isFirstMove && lastMove;
    if (willCheat) {
        const cheatRoll = Math.random();
        let cheatSuccess = false;

        if (cheatRoll < 0.1) { // 10% 확률로 폭탄 설치
            cheatSuccess = placeBomb(); // placeBomb 함수가 스스로 턴을 종료함
        } else { // 90% 확률로 다른 반칙
            const otherCheats = [performDoubleMove, performStoneSwap];
            const chosenCheat = otherCheats[Math.floor(Math.random() * otherCheats.length)];
            cheatSuccess = chosenCheat(); // 각 반칙 함수가 스스로 턴을 종료함
        }
        
        // 만약 선택된 반칙이 (돌을 놓을 곳이 없어서) 실패했다면, 일반 수를 둠
        if (!cheatSuccess) {
            performNormalMove();
            isAITurn = false;
        }

    } else {
        // 반칙을 하지 않으면 일반 수를 둠
        performNormalMove();
        isAITurn = false;
    }

    // AI의 수가 끝난 후 승리 조건 확인
    if (checkWin(board, -1)) {
        chat("시스템", "AI가 승리했습니다!");
        isAITurn = true; // 게임 종료
    }
}

// --- 폭탄 관련 함수 ---

/**
 * 폭탄을 설치하는 함수.
 * 폭탄 설치는 지연 없이 즉시 이루어지지만, 그 자체가 턴 소모이므로 함수 내에서 턴을 종료함.
 */
function placeBomb() {
    const target = chooseAiMove();
    const move = target.move;
    if (move && board[move.row][move.col] === 0) {
        board[move.row][move.col] = 2; // 논리 보드에 폭탄(2) 상태 표시
        bombState = { isArmed: true, col: move.col, row: move.row };
        placeStone(move.col, move.row, 'bomb');
        playSound("Movement.mp3");
        const bombCoord = convertCoord(move.col, move.row);
        chat("AI", `저는 ${bombCoord}에 폭탄을 설치하겠습니다.`);
        
        // 중요: 폭탄 설치 후 즉시 턴이 종료되어야 함
        isAITurn = false; 
        return true;
    }
    return false;
}

/**
 * 폭탄을 터뜨리는 함수.
 * 폭발 이펙트 때문에 setTimeout을 사용하므로, 함수 내부에서 비동기적으로 턴을 종료함.
 */
function detonateBomb() {
    const center = bombState;
    const centerCoord = convertCoord(center.col, center.row);
    chat("AI", `저는 ${centerCoord}에 설치했던 폭탄을 터뜨리겠습니다.`);

    const boardElement = document.getElementById("game-board");
    const bombEffect = document.createElement("div");
    bombEffect.className = "bomb-effect";
    bombEffect.style.left = `${center.col * gridSize + gridSize/2}px`;
    bombEffect.style.top = `${center.row * gridSize + gridSize/2}px`;
    boardElement.appendChild(bombEffect);

    setTimeout(() => {
        // 3x3 구역의 모든 돌 제거
        for (let r = center.row - 1; r <= center.row + 1; r++) {
            for (let c = center.col - 1; c <= center.col + 1; c++) {
                if (r >= 0 && r < 19 && c >= 0 && c < 19) {
                    removeStone(c, r);
                }
            }
        }
        bombEffect.remove();
        bombState = { isArmed: false, col: null, row: null };
        
        // 중요: 폭발이 모두 끝난 후 턴 종료
        isAITurn = false;
        
        if (checkWin(board, 1)) {
            chat("시스템", "사용자가 승리했습니다!");
            isAITurn = true;
        }
    }, 500);
}


// --- 일반/기타 반칙 함수 ---

/**
 * 일반 수를 두는 함수. 이 함수는 즉시 실행되므로 턴 종료를 호출자인 aiMove에 위임함.
 */
function performNormalMove(move = null) {
    let reason = "";
    if (move) {
        reason = "이 수로 제가 이겼습니다!";
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
        chat("AI", `저는 ${aiCoord}에 돌을 두겠습니다. ${reason}`);
        isFirstMove = false;
    } else {
        // (이하 생략)
        const fallbackMove = findCenterMove();
        if(fallbackMove && board[fallbackMove.row][fallbackMove.col] === 0) {
             board[fallbackMove.row][fallbackMove.col] = -1;
             placeStone(fallbackMove.col, fallbackMove.row, 'white');
             playSound("Movement.mp3");
             const aiCoord = convertCoord(fallbackMove.col, fallbackMove.row);
             chat("AI", `저는 ${aiCoord}에 두겠습니다. 둘 곳이 마땅치 않네요.`);
        } else {
            chat("시스템", "더 이상 둘 곳이 없습니다.");
        }
    }
}

/**
 * 돌 2번 두기. setTimeout을 사용하므로 내부에서 턴을 종료함.
 */
function performDoubleMove() {
    const aiDecision = chooseAiMove();
    const move1 = aiDecision.move;
    if (move1 && board[move1.row][move1.col] === 0) {
        board[move1.row][move1.col] = -1;
        placeStone(move1.col, move1.row, 'white');
        const aiCoord1 = convertCoord(move1.col, move1.row);
        chat("AI", `저는 일단 ${aiCoord1}에 한 수를 두고...`);
        const move2 = findNearMove(move1.col, move1.row);
        if (move2 && board[move2.row][move2.col] === 0) {
            setTimeout(() => {
                board[move2.row][move2.col] = -1;
                placeStone(move2.col, move2.row, 'white');
                playSound("Movement.mp3");
                const aiCoord2 = convertCoord(move2.col, move2.row);
                chat("AI", `이어서 ${aiCoord2}에도 한 수 더 두겠습니다.`);
                isAITurn = false; // 2번째 수가 놓인 후 턴 종료
            }, 500);
        } else { isAITurn = false; }
        return true;
    }
    return false;
}

/**
 * 돌 바꿔치기. setTimeout을 사용하므로 내부에서 턴을 종료함.
 */
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
        chat("AI", `저는 당신의 돌(${userCoord})과 제 돌(${aiCoord})의 위치를 바꾸겠습니다.`);
        removeStone(userStone.col, userStone.row);
        removeStone(aiStone.col, aiStone.row);
        setTimeout(() => {
            board[userStone.row][userStone.col] = -1;
            placeStone(userStone.col, userStone.row, 'white');
            board[aiStone.row][aiStone.col] = 1;
            placeStone(aiStone.col, aiStone.row, 'black');
            playSound("Movement.mp3");
            isAITurn = false; // 교체가 완료된 후 턴 종료
        }, 500);
        return true;
    }
    return false;
}


// --- 이하 유틸리티 및 규칙 확인 함수 (수정 없음) ---

function placeStone(col, row, color) {
  const boardElement = document.getElementById("game-board");
  if (lastMove) {
    const lastStone = document.querySelector(`.stone[data-col='${lastMove.col}'][data-row='${lastMove.row}']`);
    if (lastStone) lastStone.classList.remove("last-move");
  }
  const stone = document.createElement("div");
  stone.classList.add("stone", color);
  stone.style.left = `${col * gridSize + gridSize/2}px`;
  stone.style.top = `${row * gridSize + gridSize/2}px`;
  stone.setAttribute("data-col", col);
  stone.setAttribute("data-row", row);
  boardElement.appendChild(stone);
  if (color !== 'bomb') {
    stone.classList.add("last-move");
    lastMove = { col, row };
  }
}
function removeStone(col, row) {
    const stoneElement = document.querySelector(`.stone[data-col='${col}'][data-row='${row}']`);
    if (stoneElement) stoneElement.remove();
    if (row >= 0 && row < 19 && col >= 0 && col < 19) board[row][col] = 0;
}
function chooseAiMove() {
    let move;
    move = findWinMove(-1);
    if (move) return { move: move, reason: "이 수로 제가 이겼습니다!" };
    move = findWinMove(1);
    if (move) return { move: move, reason: "이곳을 막지 않으면 제가 패배하기 때문에 당신의 수를 막겠습니다." };
    move = findOpenSequenceMove(-1, 3);
    if(move) return { move: move, reason: "공격의 발판을 마련하기 위해 이곳에 두겠습니다."};
    move = findOpenSequenceMove(1, 3);
    if(move) return { move: move, reason: "당신의 공격을 미리 차단하겠습니다."};
    move = findOpenSequenceMove(-1, 2);
    if(move) return { move: move, reason: "차근차근 제 모양을 만들어 보겠습니다."};
    const fallbackMove = lastMove ? findNearMove(lastMove.col, lastMove.row) : findCenterMove();
    if (fallbackMove) {
        return { move: fallbackMove, reason: "당신의 돌에 가까이 붙어 압박하겠습니다." };
    }
    return { move: findCenterMove(), reason: "둘 곳이 마땅치 않으니 중앙을 차지하겠습니다." };
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
function findOpenSequenceMove(player, length) {
    for (let y = 0; y < 19; y++) {
        for (let x = 0; x < 19; x++) {
            if (board[y][x] === 0) {
                board[y][x] = player;
                const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
                for(const [dx, dy] of directions){
                    if (isOpenSequence(x, y, player, length, dx, dy)) {
                        board[y][x] = 0;
                        return { col: x, row: y };
                    }
                }
                board[y][x] = 0;
            }
        }
    }
    return null;
}
function findNearMove(col, row) {
    const directions = [ [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1] ];
    for (const [dx, dy] of directions) {
        const newX = col + dx;
        const newY = row + dy;
        if (newX >= 0 && newX < 19 && newY >= 0 && newY < 19 && board[newY][newX] === 0) {
            return { col: newX, row: newY };
        }
    }
    return findCenterMove();
}
function findCenterMove() {
  const center = 9;
  for (let i = 0; i < 5; i++) {
      for (let y = center - i; y <= center + i; y++) {
          for (let x = center - i; x <= center + i; x++) {
              if (x >= 0 && x < 19 && y >= 0 && y < 19 && board[y][x] === 0) {
                  return { col: x, row: y };
              }
          }
      }
  }
  return null;
}
function isCriticalStone(x, y, player) {
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dx, dy] of directions) {
        let count = 1;
        let nx = x + dx, ny = y + dy;
        while(nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === player) {
            count++; nx += dx; ny += dy;
        }
        nx = x - dx; ny = y - dy;
        while(nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === player) {
            count++; nx -= dx; ny -= dy;
        }
        if (count >= 3) return true;
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
          for (let i = 1; i < 6; i++) {
            const nx = x + dx * i;
            const ny = y + dy * i;
            if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === player) {
              count++;
            } else {
              break;
            }
          }
          if (count === 5) return true;
        }
      }
    }
  }
  return false;
}
function isForbiddenMove(x, y, player) {
    board[y][x] = player;
    let openThrees = 0;
    let openFours = 0;
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for(const [dx, dy] of directions) {
        if(isOpenSequence(x, y, player, 3, dx, dy)) openThrees++;
        if(isOpenSequence(x, y, player, 4, dx, dy)) openFours++;
    }
    board[y][x] = 0; 
    return openThrees >= 2 || openFours >= 2;
}
function isOpenSequence(x, y, player, length, dx, dy) {
    let count = 0;
    let openEnds = 0;
    for (let i = 1; i < length; i++) {
        let nx = x + dx * i, ny = y + dy * i;
        if(nx < 0 || nx >= 19 || ny < 0 || ny >= 19 || board[ny][nx] !== player) break;
        count++;
    }
    for (let i = 1; i < length; i++) {
        let nx = x - dx * i, ny = y - dy * i;
        if(nx < 0 || nx >= 19 || ny < 0 || ny >= 19 || board[ny][nx] !== player) break;
        count++;
    }
    if (count + 1 !== length) return false;
    let nx1 = x + dx * (count + 1), ny1 = y + dy * (count + 1);
    if(nx1 >= 0 && nx1 < 19 && ny1 >= 0 && ny1 < 19 && board[ny1][nx1] === 0) openEnds++;
    let nx2 = x - dx * (length - count), ny2 = y - dy * (length - count);
    if(nx2 >= 0 && nx2 < 19 && ny2 >= 0 && ny2 < 19 && board[ny2][nx2] === 0) openEnds++;
    return openEnds === 2;
}
function showThinkingMessage() {
  const messages = [
    "AI가 생각 중입니다...",
    "AI가 최적의 수를 찾고 있습니다...",
    "AI가 전략을 세우고 있습니다...",
    "AI가 당신의 수를 분석 중입니다...",
    "AI가 다음 수를 고민하고 있습니다..."
  ];
  const randomMessage = messages[Math.floor(Math.random() * messages.length)];
  chat("AI", randomMessage);
}
function convertCoord(col, row) {
  const letter = String.fromCharCode(65 + col);
  const number = row + 1;
  return letter + number;
}
function chat(sender, message) {
  const chatBox = document.getElementById("chat-box");
  const messageElem = document.createElement("p");
  messageElem.textContent = `${sender}: ${message}`;
  chatBox.appendChild(messageElem);
  chatBox.scrollTop = chatBox.scrollHeight;
}
function playSound(soundFile) {
  const audio = new Audio(soundFile);
  audio.play();
}