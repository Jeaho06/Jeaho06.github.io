// 오목판 배열 (19x19)
const board = Array(19).fill().map(() => Array(19).fill(0));

// 인공지능이 반칙을 할 때 메시지를 출력
function aiMove() {
    let move = chooseAiMove();
    board[move.row][move.col] = -1; // AI의 차례
    updateBoard();
    // AI의 반칙 메시지 출력 (가령, 좋은 수일 경우)
    chat("AI", `${move.row},${move.col}!`);
}

// 사용자의 턴 (사용자가 클릭)
function userMove(row, col) {
    if (board[row][col] === 0) {
        board[row][col] = 1; // 사용자의 차례
        updateBoard();
        // AI의 반칙을 자동으로 진행
        aiMove();
    }
}

// 보드 업데이트
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
            cell.addEventListener("click", () => userMove(row, col));
            tableRow.appendChild(cell);
        }
        boardTable.appendChild(tableRow);
    }
}

// 인공지능의 채팅 메시지를 출력하는 함수
function chat(sender, message) {
    const chatBox = document.getElementById("chat-box");
    const messageElem = document.createElement("p");
    messageElem.textContent = `${sender}: ${message}`;
    chatBox.appendChild(messageElem);
    chatBox.scrollTop = chatBox.scrollHeight;  // 채팅창 스크롤 내리기
}

// 인공지능의 수를 선택하는 함수 (예시)
function chooseAiMove() {
    // 여기서는 간단히 랜덤으로 수를 두는 방식으로 설정
    // 나중에 더 정교한 반칙 로직을 추가할 수 있습니다.
    let row = Math.floor(Math.random() * 19);
    let col = Math.floor(Math.random() * 19);
    while (board[row][col] !== 0) {
        row = Math.floor(Math.random() * 19);
        col = Math.floor(Math.random() * 19);
    }
    return { row, col };
}

// 게임 시작
updateBoard();
