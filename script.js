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

    board[closestY][closestX] = 1;
    placeStone(closestX, closestY, 'white');
    aiMove();
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
  if (board[move.row][move.col] !== 0) {
    chat("AI", "반칙을 했습니다! 하하하!");
  }
  board[move.row][move.col] = -1;
  placeStone(move.col, move.row, 'black');
  const coordStr = convertCoord(move.col, move.row);
  chat("AI", `${coordStr}!`);
}

function chooseAiMove() {
  const cheatProbability = 0.1;

  if (Math.random() < cheatProbability) {
    let col = Math.floor(Math.random() * 19);
    let row = Math.floor(Math.random() * 19);
    while (board[row][col] === 0) {
      col = Math.floor(Math.random() * 19);
      row = Math.floor(Math.random() * 19);
    }
    return { col, row };
  }

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
            return true;
          }
        }
      }
    }
  }
  return false;
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