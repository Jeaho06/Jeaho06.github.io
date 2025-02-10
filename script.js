// script.js

// AI 보드와 사용자 보드 생성 (기본적으로 동일한 구조로 설정)
function createBoard(boardId) {
    const board = document.getElementById(boardId);
    for (let i = 0; i < 19; i++) {
        const row = document.createElement("tr");
        for (let j = 0; j < 19; j++) {
            const cell = document.createElement("td");
            row.appendChild(cell);
        }
        board.appendChild(row);
    }
}

createBoard("ai-board");
createBoard("user-board");

// 인공지능 메시지 출력 함수
function sendMessage() {
    const chatInput = document.getElementById("chat-input");
    const chatBox = document.getElementById("chat-box");

    const message = chatInput.value;
    if (message) {
        const messageElement = document.createElement("div");
        messageElement.textContent = message;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;  // 채팅창 스크롤을 최신 메시지로 이동
        chatInput.value = "";
    }
}

// 인공지능 반칙 및 메시지 예시
function aiMove(row, col, type) {
    const aiMessage = document.getElementById("chat-input");
    const message = `${String.fromCharCode(65 + col)}${19 - row} ${type === 'good' ? '!' : '?'} (AI의 수)`;

    sendMessage(); // 채팅 전송
    aiMessage.value = message;  // 채팅에 메시지 추가
}

// 예시: AI가 반칙을 했을 때
aiMove(4, 5, 'bad'); // 예시: 잘못된 수 (반칙)
s