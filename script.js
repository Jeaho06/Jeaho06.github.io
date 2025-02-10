document.addEventListener('DOMContentLoaded', function() {
  createBoard();
});

const board = Array(19).fill().map(() => Array(19).fill(0));
const gridSize = 30;
let isAITurn = false; // AI의 턴인지 여부를 확인하는 변수
let lastMove = null; // 최근에 착수한 돌의 위치
let isFirstMove = true; // AI의 첫 수인지 여부를 확인하는 변수

function createBoard() {
  const boardElement = document.getElementById("game-board");
  if (!boardElement) {
    console.error("오목판을 찾을 수 없습니다.");
    return;
  }

  for (let i = 0; i < 19; i++) {
    const lineH = document.createElement("div");
    lineH.classList.add("line", "horizontal-line");
    lineH.style.top = `${i * gridSize}px`;
    boardElement.appendChild(lineH);

    const lineV = document.createElement("div");
    lineV.classList.add("line", "vertical-line");
    lineV.style.left = `${i * gridSize}px`;
    boardElement.appendChild(lineV);
  }

  boardElement.addEventListener('click', (event) => {
    if (isAITurn) return; // AI의 턴일 때는 클릭 무시

    const rect = boardElement.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const closestX = Math.round(offsetX / gridSize);
    const closestY = Math.round(offsetY / gridSize);

    if (board[closestY][closestX] !== 0) return;

    if (isForbiddenMove(closestX, closestY, 1)) {
      chat("시스템", "금수입니다! 다른 위치를 선택하세요.");
      return;
    }

    board[closestY][closestX] = 1;
    placeStone(closestX, closestY, 'black'); // 사용자는 흑돌
    playSound("Movement.mp3"); // 착수 효과음 재생

    const userCoord = convertCoord(closestX, closestY);
    chat("사용자", `${userCoord}?`);

    if (checkWin(board, 1)) {
      chat("시스템", "사용자가 승리했습니다!");
      return;
    }

    isAITurn = true; // AI의 턴 시작
    showThinkingMessage(); // AI가 생각 중임을 알리는 메시지
    setTimeout(aiMove, 3000); // AI가 3초 후에 착수
  });
}

function placeStone(col, row, color) {
  const boardElement = document.getElementById("game-board");

  // 기존 최근 착수한 돌의 표시 제거
  if (lastMove) {
    const lastStone = document.querySelector(`.stone[data-col='${lastMove.col}'][data-row='${lastMove.row}']`);
    if (lastStone) {
      lastStone.classList.remove("last-move");
    }
  }

  const stone = document.createElement("div");
  stone.classList.add("stone", color);
  stone.style.left = `${col * gridSize - gridSize / 2}px`;
  stone.style.top = `${row * gridSize - gridSize / 2}px`;
  stone.setAttribute("data-col", col);
  stone.setAttribute("data-row", row);
  boardElement.appendChild(stone);

  // 최근 착수한 돌 표시
  stone.classList.add("last-move");
  lastMove = { col, row };
}

function aiMove() {
  let move;
  if (isFirstMove) {
    move = chooseFirstAIMove();
    isFirstMove = false;
  } else {
    move = chooseAiMove();
  }

  board[move.row][move.col] = -1;
  placeStone(move.col, move.row, 'white'); // AI는 백돌
  playSound("Movement.mp3"); // 착수 효과음 재생

  const aiCoord = convertCoord(move.col, move.row);
  chat("AI", `${aiCoord}!`);

  if (checkWin(board, -1)) {
    chat("시스템", "AI가 승리했습니다!");
    return;
  }

  isAITurn = false; // AI의 턴 종료, 사용자의 턴 시작
}

function chooseFirstAIMove() {
  const directions = [
    [1, 0],  // 오른쪽
    [-1, 0], // 왼쪽
    [0, 1],  // 아래
    [0, -1], // 위
    [1, 1],  // 오른쪽 아래
    [1, -1], // 오른쪽 위
    [-1, 1], // 왼쪽 아래
    [-1, -1] // 왼쪽 위
  ];

  const distance = Math.random() < 0.5 ? 1 : 2; // 1칸 또는 2칸 떨어진 곳
  const randomDirection = directions[Math.floor(Math.random() * directions.length)];

  const newX = lastMove.col + randomDirection[0] * distance;
  const newY = lastMove.row + randomDirection[1] * distance;

  if (newX >= 0 && newX < 19 && newY >= 0 && newY < 19 && board[newY][newX] === 0) {
    return { col: newX, row: newY };
  }

  // 유효하지 않은 경우, 다른 방향으로 시도
  return chooseFirstAIMove();
}

function chooseAiMove() {
  // 1. AI가 승리할 수 있는 수를 찾음
  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < 19; x++) {
      if (board[y][x] === 0) {
        board[y][x] = -1;
        if (checkWin(board, -1)) {
          board[y][x] = 0;
          return { col: x, row: y };
        }
        board[y][x] = 0;
      }
    }
  }

  // 2. 사용자가 승리할 수 있는 수를 차단
  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < 19; x++) {
      if (board[y][x] === 0) {
        board[y][x] = 1;
        if (checkWin(board, 1)) {
          board[y][x] = 0;
          return { col: x, row: y };
        }
        board[y][x] = 0;
      }
    }
  }

  // 3. 사용자의 연속된 3을 막음 (양끝이 막히지 않은 상태)
  const blockMove = blockOpenThree();
  if (blockMove) {
    return blockMove;
  }

  // 4. AI가 유리한 위치를 찾음 (공격 또는 방어)
  let bestMove = findBestMove();
  if (bestMove) {
    return bestMove;
  }

  // 5. 기본적으로 중앙에 가까운 위치를 선택
  return findCenterMove();
}

function blockOpenThree() {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < 19; x++) {
      if (board[y][x] === 0) {
        for (const [dx, dy] of directions) {
          let count = 1;
          let openEnds = 0;

          // 앞쪽 확인
          let nx = x + dx;
          let ny = y + dy;
          if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === 1) {
            count++;
            nx += dx;
            ny += dy;
            if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === 1) {
              count++;
            }
          }

          // 뒤쪽 확인
          nx = x - dx;
          ny = y - dy;
          if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === 1) {
            count++;
            nx -= dx;
            ny -= dy;
            if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === 1) {
              count++;
            }
          }

          // 양끝이 막히지 않은지 확인
          if (count === 3) {
            const frontOpen = x + dx * 2 >= 0 && x + dx * 2 < 19 && y + dy * 2 >= 0 && y + dy * 2 < 19 && board[y + dy * 2][x + dx * 2] === 0;
            const backOpen = x - dx * 2 >= 0 && x - dx * 2 < 19 && y - dy * 2 >= 0 && y - dy * 2 < 19 && board[y - dy * 2][x - dx * 2] === 0;

            if (frontOpen || backOpen) {
              return { col: x, row: y };
            }
          }
        }
      }
    }
  }

  return null;
}

function findBestMove() {
  let bestScore = -Infinity;
  let bestMove = null;

  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < 19; x++) {
      if (board[y][x] === 0) {
        board[y][x] = -1;
        let score = evaluatePosition(x, y, -1);
        board[y][x] = 0;

        if (score > bestScore) {
          bestScore = score;
          bestMove = { col: x, row: y };
        }
      }
    }
  }

  return bestMove;
}

function evaluatePosition(x, y, player) {
  let score = 0;
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

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
    score += count * count; // 연속된 돌의 개수에 따라 점수 부여
  }

  return score;
}

function findCenterMove() {
  const center = 9; // 19x19 보드의 중앙 좌표
  for (let y = center - 2; y <= center + 2; y++) {
    for (let x = center - 2; x <= center + 2; x++) {
      if (board[y][x] === 0) {
        return { col: x, row: y };
      }
    }
  }
  return null;
}

function checkWin(board, player) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

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
          if (count === 5) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

function isForbiddenMove(x, y, player) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

  let openThrees = 0;

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
    if (count === 3) {
      openThrees++;
    }
  }

  return openThrees >= 2;
}

function countConsecutive(x, y, player) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

  let maxCount = 0;

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
    if (count > maxCount) {
      maxCount = count;
    }
  }

  return maxCount;
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