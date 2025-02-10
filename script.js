// script.js

// 19x19 보드판 생성
const board = document.getElementById("board");

for (let i = 0; i < 19; i++) {
    const row = document.createElement("tr");
    for (let j = 0; j < 19; j++) {
        const cell = document.createElement("td");
        cell.addEventListener("click", () => placeStone(i, j)); // 클릭 이벤트로 돌 놓기
        row.appendChild(cell);
    }
    board.appendChild(row);
}

// 현재 턴: 'black' 또는 'white'
let currentTurn = "black";

// 돌을 놓는 함수
function placeStone(row, col) {
    const cell = board.rows[row].cells[col];

    // 이미 돌이 놓여있는 위치는 클릭할 수 없게 처리
    if (cell.children.length > 0) return;

    // 돌 놓기
    const stone = document.createElement("div");
    stone.classList.add(currentTurn);
    cell.appendChild(stone);

    // 턴 바꾸기
    currentTurn = currentTurn === "black" ? "white" : "black";
}
