document.addEventListener('DOMContentLoaded', function() {
    createBoard();
});

const board = Array(19).fill().map(() => Array(19).fill(0)); // 19x19 바둑판 배열

function createBoard() {
    const boardElement = document.getElementById("game-board");
    if (!boardElement) {
        console.error("오목판을 찾을 수 없습니다.");
        return;
    }

    // 수평선과 수직선 그리기
    for (let i = 0; i < 19; i++) {
        const lineH = document.createElement("div");
        lineH.classList.add("line", "horizontal-line");
        lineH.style.top = `${i * 30}px`;
        lineH.style.width = "100%";
        lineH.style.height = "1px";
        boardElement.appendChild(lineH);

        const lineV = document.createElement("div");
        lineV.classList.add("line", "vertical-line");
        lineV.style.left = `${i * 30}px`;
        lineV.style.width = "1px";
        lineV.style.height = "100%";
        boardElement.appendChild(lineV);
    }

    // 클릭 이벤트 추가 (교차점 클릭 시 돌 놓기)
    boardElement.addEventListener('click', (event) => {
        const x = Math.floor(event.offsetX / 30);
        const y = Math.floor(event.offsetY / 30);

        if (board[x][y] === 0) {
            board[x][y] = 1; // 사용자 차례
            placeStone(x, y, 'white');
            aiMove(); // AI 차례
        }
    });
}

function placeStone(x, y, color) {
    const boardElement = document.getElementById("game-board");

    const stone = document.createElement("div");
    stone.classList.add("stone", color);
    stone.style.left = `${x * 30}px`;
    stone.style.top = `${y * 30}px`;
    boardElement.appendChild(stone);
}

function aiMove() {
    let move = chooseAiMove(); // AI의 수 선택
    board[move.x][move.y] = -1; // AI의 차례
    placeStone(move.x, move.y, 'black');
    chat("AI", `${move.x},${move.y}!`); // AI의 반칙 메시지 출력
}

function chooseAiMove() {
    let x = Math.floor(Math.random() * 19);
    let y = Math.floor(Math.random() * 19);
    while (board[x][y] !== 0) {
        x = Math.floor(Math.random() * 19);
        y = Math.floor(Math.random() * 19);
    }
    return { x, y };
}

function chat(sender, message) {
    const chatBox = document.getElementById("chat-box");
    const messageElem = document.createElement("p");
    messageElem.textContent = `${sender}: ${message}`;
    chatBox.appendChild(messageElem);
    chatBox.scrollTop = chatBox.scrollHeight; // 채팅창 스크롤 내리기
}
