document.addEventListener('DOMContentLoaded', function() {
  createBoard();
});

// 19x19 바둑판 상태 (0: 빈칸, 1: 사용자, -1: AI)
const board = Array(19).fill().map(() => Array(19).fill(0));
const gridSize = 30; // 격자 간격 (픽셀)

// 바둑판 생성: 격자 선을 그립니다.
function createBoard() {
  const boardElement = document.getElementById("game-board");
  if (!boardElement) {
    console.error("오목판을 찾을 수 없습니다.");
    return;
  }

  // 수평선 및 수직선 그리기 (교차점을 기준으로)
  for (let i = 0; i < 19; i++) {
    // 수평선
    const lineH = document.createElement("div");
    lineH.classList.add("line", "horizontal-line");
    lineH.style.top = `${i * gridSize}px`;
    boardElement.appendChild(lineH);

    // 수직선
    const lineV = document.createElement("div");
    lineV.classList.add("line", "vertical-line");
    lineV.style.left = `${i * gridSize}px`;
    boardElement.appendChild(lineV);
  }

  // 클릭 이벤트 처리: 마우스 클릭 위치를 정확하게 보정
  boardElement.addEventListener('click', (event) => {
    const rect = boardElement.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    // 가장 가까운 교차점을 구합니다.
    const closestX = Math.round(offsetX / gridSize);
    const closestY = Math.round(offsetY / gridSize);

    // 이미 돌이 있으면 무시
    if (board[closestY][closestX] !== 0) return;

    // 사용자 차례: 돌을 놓고 상태 업데이트
    board[closestY][closestX] = 1;
    placeStone(closestX, closestY, 'white');
    // AI 차례 진행
    aiMove();
  });
}

// 돌 배치: 돌의 중앙이 교차점에 오도록 보정합니다.
function placeStone(col, row, color) {
  const boardElement = document.getElementById("game-board");

  const stone = document.createElement("div");
  stone.classList.add("stone", color);
  // 교차점 좌표는 gridSize 단위, 돌의 중심이 교차점에 오도록 gridSize/2만큼 보정
  stone.style.left = `${col * gridSize - gridSize / 2}px`;
  stone.style.top = `${row * gridSize - gridSize / 2}px`;
  boardElement.appendChild(stone);
}

// AI의 수 선택 및 착수
function aiMove() {
  const move = chooseAiMove();
  board[move.row][move.col] = -1;
  placeStone(move.col, move.row, 'black');
  // 채팅 메시지: 좌표는 영어와 숫자의 조합 (예: A1, B5 등)
  const coordStr = convertCoord(move.col, move.row);
  chat("AI", `${coordStr}!`);
}

// AI의 수 선택 (랜덤 선택 예시)
function chooseAiMove() {
  let col = Math.floor(Math.random() * 19);
  let row = Math.floor(Math.random() * 19);
  while (board[row][col] !== 0) {
    col = Math.floor(Math.random() * 19);
    row = Math.floor(Math.random() * 19);
  }
  return { col, row };
}

// 좌표 변환: 열은 A~?, 행은 1~19 (열: 0 → A, 1 → B, …)
function convertCoord(col, row) {
  // 사용자 요청: 가로는 A~T, 세로는 1~19
  // 0번 열은 A, 1번은 B, ... (board는 19열이므로 A ~ S가 사용됩니다.)
  const letter = String.fromCharCode(65 + col); // 65 = 'A'
  const number = row + 1;
  return letter + number;
}

// 채팅창에 메시지 추가 (예전 스타일)
function chat(sender, message) {
  const chatBox = document.getElementById("chat-box");
  const messageElem = document.createElement("p");
  messageElem.textContent = `${sender}: ${message}`;
  chatBox.appendChild(messageElem);
  chatBox.scrollTop = chatBox.scrollHeight;
}
