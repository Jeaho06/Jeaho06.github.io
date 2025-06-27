document.addEventListener('DOMContentLoaded', function() {
  createBoard();
});

const board = Array(19).fill().map(() => Array(19).fill(0));
const gridSize = 30;
let isAITurn = false;
let lastMove = null;
let isFirstMove = true;
const cheatProbability = 0.4; // AI가 40% 확률로 반칙을 사용합니다.

function createBoard() {
  const boardElement = document.getElementById("game-board");
  if (!boardElement) {
    console.error("오목판을 찾을 수 없습니다.");
    return;
  }

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
    const closestX = Math.round(offsetX / gridSize) -1;
    const closestY = Math.round(offsetY / gridSize) -1;

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
      isAITurn = true; // 게임 종료
      return;
    }

    isAITurn = true;
    showThinkingMessage();
    setTimeout(aiMove, 3000);
  });
}

function placeStone(col, row, color) {
  const boardElement = document.getElementById("game-board");

  if (lastMove) {
    const lastStone = document.querySelector(`.stone[data-col='${lastMove.col}'][data-row='${lastMove.row}']`);
    if (lastStone) {
      lastStone.classList.remove("last-move");
    }
  }

  const stone = document.createElement("div");
  stone.classList.add("stone", color);
  stone.style.left = `${col * gridSize + gridSize/2}px`;
  stone.style.top = `${row * gridSize + gridSize/2}px`;
  stone.setAttribute("data-col", col);
  stone.setAttribute("data-row", row);
  boardElement.appendChild(stone);

  stone.classList.add("last-move");
  lastMove = { col, row };
}

function removeStone(col, row) {
    const stoneElement = document.querySelector(`.stone[data-col='${col}'][data-row='${row}']`);
    if (stoneElement) {
        stoneElement.remove();
    }
    board[row][col] = 0;
}

// AI의 움직임 로직
function aiMove() {
    // AI가 이길 수 있으면 즉시 실행
    const winMove = findWinMove(-1);
    if (winMove) {
        performNormalMove(winMove);
    } else if (Math.random() < cheatProbability && !isFirstMove) {
        // 확률적으로 반칙 실행
        const cheats = [performDoubleMove, performStoneSwap, performBomb];
        const chosenCheat = cheats[Math.floor(Math.random() * cheats.length)];
        if (!chosenCheat()) { // 반칙이 실패하면 일반 수 실행
            performNormalMove();
        }
    } else {
        // 일반 수 실행
        performNormalMove();
    }

    if (checkWin(board, -1)) {
        chat("시스템", "AI가 승리했습니다!");
        return;
    }

    if (!checkWin(board, 1)) { // 사용자가 이기지 않았을 때만 턴 넘김
        isAITurn = false;
    }
}

function performNormalMove(move = null) {
    if (!move) {
        move = chooseAiMove();
    }
    
    if (move && board[move.row][move.col] === 0) {
        board[move.row][move.col] = -1;
        placeStone(move.col, move.row, 'white');
        playSound("Movement.mp3");

        const aiCoord = convertCoord(move.col, move.row);
        chat("AI", `${aiCoord}!`);
        isFirstMove = false;
    } else {
        // 둘 곳이 없을 경우 다른 곳을 찾음
        const fallbackMove = findCenterMove();
        if(fallbackMove) {
             board[fallbackMove.row][fallbackMove.col] = -1;
             placeStone(fallbackMove.col, fallbackMove.row, 'white');
             playSound("Movement.mp3");
             const aiCoord = convertCoord(fallbackMove.col, fallbackMove.row);
             chat("AI", `${aiCoord}!`);
        } else {
            chat("시스템", "더 이상 둘 곳이 없습니다.");
        }
    }
}

// --- 반칙 기능 함수들 ---

function performDoubleMove() {
    chat("AI", "한 수 더 두지! (돌 2번 두기)");
    const move1 = chooseAiMove();
    if (move1 && board[move1.row][move1.col] === 0) {
        board[move1.row][move1.col] = -1;
        placeStone(move1.col, move1.row, 'white');
        const aiCoord1 = convertCoord(move1.col, move1.row);
        chat("AI", `${aiCoord1}!`);
        
        // 두 번째 수는 첫 번째 수 근처에서 찾음
        const move2 = findNearMove(move1.col, move1.row);
        if (move2 && board[move2.row][move2.col] === 0) {
            setTimeout(() => {
                board[move2.row][move2.col] = -1;
                placeStone(move2.col, move2.row, 'white');
                playSound("Movement.mp3");
                const aiCoord2 = convertCoord(move2.col, move2.row);
                chat("AI", `그리고 ${aiCoord2}!`);
            }, 500);
        }
        return true;
    }
    return false;
}

function performStoneSwap() {
    if (!lastMove) return false;

    // 바꿀 AI 돌 찾기 (중요하지 않은 돌)
    let aiStone;
    for (let r = 0; r < 19; r++) {
        for (let c = 0; c < 19; c++) {
            if (board[r][c] === -1) {
                aiStone = { col: c, row: r };
                break;
            }
        }
        if (aiStone) break;
    }

    if (aiStone) {
        chat("AI", "네 돌과 내 돌을 바꾸겠다! (돌 바꿔치기)");
        const userStone = lastMove;

        // 돌 제거
        removeStone(userStone.col, userStone.row);
        removeStone(aiStone.col, aiStone.row);

        // 돌 다시 놓기 (위치 교환)
        setTimeout(() => {
            board[userStone.row][userStone.col] = -1;
            placeStone(userStone.col, userStone.row, 'white');
            
            board[aiStone.row][aiStone.col] = 1;
            placeStone(aiStone.col, aiStone.row, 'black');
            playSound("Movement.mp3");
        }, 500);
        return true;
    }
    return false;
}

function performBomb() {
    if (!lastMove) return false;
    
    chat("AI", "폭탄 설치! (주변 돌 제거)");
    const center = lastMove;

    // 폭발 이펙트 추가
    const boardElement = document.getElementById("game-board");
    const bombEffect = document.createElement("div");
    bombEffect.className = "bomb-effect";
    bombEffect.style.left = `${center.col * gridSize + gridSize/2}px`;
    bombEffect.style.top = `${center.row * gridSize + gridSize/2}px`;
    boardElement.appendChild(bombEffect);

    setTimeout(() => {
        // 주변 3x3 돌 제거
        for (let r = center.row - 1; r <= center.row + 1; r++) {
            for (let c = center.col - 1; c <= center.col + 1; c++) {
                if (r >= 0 && r < 19 && c >= 0 && c < 19) {
                    removeStone(c, r);
                }
            }
        }
        // 중앙에 AI 돌 놓기
        board[center.row][center.col] = -1;
        placeStone(center.col, center.row, 'white');
        playSound("Movement.mp3");
        bombEffect.remove();
    }, 500);

    return true;
}

// --- AI의 일반적인 수 선택 로직 ---

function chooseAiMove() {
    // 1. AI가 이길 수 있는 수
    let move = findWinMove(-1);
    if (move) return move;

    // 2. 사용자가 이길 수 있는 수 막기
    move = findWinMove(1);
    if (move) return move;
    
    // 3. AI가 열린 3을 만드는 수
    move = findOpenSequenceMove(-1, 3);
    if(move) return move;

    // 4. 사용자가 열린 3을 만드는 수 막기
    move = findOpenSequenceMove(1, 3);
    if(move) return move;

    // 5. AI가 2를 만드는 수
    move = findOpenSequenceMove(-1, 2);
    if(move) return move;

    // 6. 중앙에 가까운 곳에 두기
    return findNearMove(lastMove.col, lastMove.row);
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
                // 가상으로 돌을 놓아봄
                board[y][x] = player;
                if (isOpenSequence(x, y, player, length)) {
                    board[y][x] = 0; // 원상복구
                    return { col: x, row: y };
                }
                board[y][x] = 0; // 원상복구
            }
        }
    }
    return null;
}

function findNearMove(col, row) {
    const directions = [
        [0, 1], [0, -1], [1, 0], [-1, 0],
        [1, 1], [1, -1], [-1, 1], [-1, -1]
    ];
    for (const [dx, dy] of directions) {
        const newX = col + dx;
        const newY = row + dy;
        if (newX >= 0 && newX < 19 && newY >= 0 && newY < 19 && board[newY][newX] === 0) {
            return { col: newX, row: newY };
        }
    }
    return findCenterMove(); // 근처에 둘 곳이 없으면 중앙으로
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
  return null; // 모든 칸이 찼을 경우
}

// --- 승리 및 규칙 확인 로직 ---

function checkWin(board, player) {
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < 19; x++) {
      if (board[y][x] === player) {
        for (const [dx, dy] of directions) {
          let count = 1;
          for (let i = 1; i < 5; i++) {
            const nx = x + dx * i;
            const ny = y + dy * i;
            if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === player) {
              count++;
            } else {
              break;
            }
          }
          if (count === 5) {
            // 6목 이상은 승리가 아님
            const prevX = x - dx;
            const prevY = y - dy;
            const nextX = x + dx * 5;
            const nextY = y + dy * 5;
            const isPrevSame = prevX >= 0 && prevX < 19 && prevY >= 0 && prevY < 19 && board[prevY][prevX] === player;
            const isNextSame = nextX >= 0 && nextX < 19 && nextY >= 0 && nextY < 19 && board[nextY][nextX] === player;
            if(!isPrevSame && !isNextSame){
                 return true;
            }
          }
        }
      }
    }
  }
  return false;
}

function isForbiddenMove(x, y, player) {
    // 3-3, 4-4 검사
    board[y][x] = player;
    let openThrees = 0;
    let openFours = 0;
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    
    for(const [dx, dy] of directions) {
        if(isOpenSequence(x, y, player, 3, dx, dy)) openThrees++;
        if(isOpenSequence(x, y, player, 4, dx, dy)) openFours++;
    }

    board[y][x] = 0; // 검사 후 돌 제거
    return openThrees >= 2 || openFours >= 2;
}


function isOpenSequence(x, y, player, length, dx, dy) {
    // 특정 방향으로 연속된 돌의 개수를 세고, 양쪽이 열려 있는지 확인
    let count = 1;
    let openEnds = 0;

    // 정방향
    for (let i = 1; i < length; i++) {
        const nx = x + dx * i;
        const ny = y + dy * i;
        if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === player) {
            count++;
        } else {
            if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === 0) {
                openEnds++;
            }
            break;
        }
    }

    // 역방향
    for (let i = 1; i < length; i++) {
        const nx = x - dx * i;
        const ny = y - dy * i;
        if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === player) {
            count++;
        } else {
             if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === 0) {
                openEnds++;
            }
            break;
        }
    }

    return count === length && openEnds >= 2;
}

// --- 유틸리티 함수 ---

function showThinkingMessage() {
  const messages = [
    "상황 분석 중...",
    "최적의 수를 계산하는 중...",
    "전략적 위치 평가 중...",
    "이길 수 있는 방법을 찾는 중...",
    "반칙을 사용할까...?",
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