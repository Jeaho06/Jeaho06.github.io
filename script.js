document.addEventListener('DOMContentLoaded', function() {
    createBoard();
});

const board = Array(19).fill().map(() => Array(19).fill(0)); // 19x19 바둑판 배열

function createBoard() {
    const boardTable = document.getElementById("game-board");
    if (!boardTable) {
        console.error("오목판을 찾을 수 없습니다.");
        return;
    }
    for (let row = 0; row < 19; row++) {
        const tableRow = document.createElement("tr");
        for (let col = 0; col < 19; col++) {
            const cell = document.createElement("td");
            cell.addEventListener("click", () => userMove(row, col)); // 클릭 시 사용자 수
            tableRow.appendChild(cell);
        }
        boardTable.appendChild(tableRow);
    }
}

function updateBoard() {
    const boardTable = document.getElementById("game-board");
    boardTable.innerHTML = ""; // 기존 보드 내용 삭제
    for (let row = 0; row < 19; row++) {
        const tableRow = document.createElement("tr");
        for (let col = 0; col < 19; col++) {
            const cell = document.createElement("td");
            if (board[row][col] === 1) {
                const piece = document.createElement("div");
                piece.classList.add("white");
                cell.appendChild(piece);
            } else if (board[row][col] === -1) {
                const piece = document.createElement("div");
                piece.classList.add("black");
                cell.appendChild(piece);
            }
            cell.addEventListener("click", () => userMove(row, col)); // 클릭 시 사용자 수
            tableRow.appendChild(cell);
        }
        boardTable.appendChild(tableRow);
    }
}

function userMove(row, col) {
    if (board[row][col] === 0) {
        board[row][col] = 1; // 사용자의 차례
        updateBoard();
        aiMove(); // AI가 수를 두는 함수
    }
}

function aiMove() {
    let move = chooseAiMove(); // AI의 수 선택 (랜덤 예시)
    board[move.row][move.col] = -1; // AI의 차례
    updateBoard();
    chat("AI", `${move.row},${move.col}!`); // AI의 반칙 메시지 출력
}

function chooseAiMove() {
    let row = Math.floor(Math.random() * 19);
    let col = Math.floor(Math.random() * 19);
    while (board[row][col] !== 0) {
        row = Math.floor(Math.random() * 19);
        col = Math.floor(Math.random() * 19);
    }
    return { row, col };
}

function chat(sender, message) {
    const chatBox = document.getElementById("chat-box");
    const messageElem = document.createElement("p");
    messageElem.textContent = `${sender}: ${message}`;
    chatBox.appendChild(messageElem);
    chatBox.scrollTop = chatBox.scrollHeight; // 채팅창 스크롤 내리기
}

updateBoard();
