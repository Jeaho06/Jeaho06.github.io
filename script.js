document.addEventListener('DOMContentLoaded', function() {
  createBoard();
});

const board = Array(19).fill().map(() => Array(19).fill(0));
const gridSize = 30;

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
    placeStone(closestX, closestY, 'white');

    const userCoord = convertCoord(closestX, closestY);
    chat("사용자", `${userCoord}?`);

    if (checkWin(board, 1)) {
      chat("시스템", "사용자가 승리했습니다!");
      return;
    }

    setTimeout(aiMove, 3000); // AI가 3초 후에 착수
  });
}

function placeStone(col, row, color) {
  const boardElement = document.getElementById("game-board");

  const stone = document.createElement("div");
  stone.classList.add("stone", color);
  stone.style.left = `${col * gridSize - gridSize / 2}px`;
  stone.style.top = `${row * gridSize - gridSize / 2}px`;
  boardElement.appendChild(stone);
}

function aiMove() {
  const move = chooseAiMove();
  board[move.row][move.col] = -1;
  placeStone(move.col, move.row, 'black');

  const aiCoord = convertCoord(move.col, move.row);
  chat("AI", `${aiCoord}!`);

  if (checkWin(board, -1)) {
    chat("시스템", "AI가 승리했습니다!");
    return;
  }
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

  // 3. 사용자의 3개 이상 연속된 돌을 차단
  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < 19; x++) {
      if (board[y][x] === 0) {
        if (countConsecutive(x, y, 1) >= 3) {
          return { col: x, row: y };
        }
      }
    }
  }

  // 4. 랜덤으로 수를 선택
  let col = Math.floor(Math.random() * 19);
  let row = Math.floor(Math.random() * 19);
  while (board[row][col] !== 0) {
    col = Math.floor(Math.random() * 19);
    row = Math.floor(Math.random() * 19);
  }
  return { col, row };
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