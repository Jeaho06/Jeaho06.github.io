// script.js

// 오목 보드 (19x19)
const board = Array(19).fill().map(() => Array(19).fill(0));

// 보드의 좌표값을 출력하는 함수
function printBoard() {
    for (let row = 0; row < 19; row++) {
        console.log(board[row].join(" "));
    }
}

// 0 = 빈 칸, 1 = 사용자, -1 = AI
// 보드 생성 함수
function createBoard(boardId) {
    const boardTable = document.getElementById(boardId);
    for (let i = 0; i < 19; i++) {
        const row = document.createElement("tr");
        for (let j = 0; j < 19; j++) {
            const cell = document.createElement("td");
            cell.addEventListener("click", () => userMove(i, j));
            row.appendChild(cell);
        }
        boardTable.appendChild(row);
    }
}

createBoard("ai-board");
createBoard("user-board");

// 승리 판별 함수
function checkWin(player) {
    for (let row = 0; row < 19; row++) {
        for (let col = 0; col < 19; col++) {
            if (board[row][col] === player) {
                if (checkDirection(row, col, 1, 0, player) ||
                    checkDirection(row, col, 0, 1, player) ||
                    checkDirection(row, col, 1, 1, player) ||
                    checkDirection(row, col, 1, -1, player)) {
                    return true;
                }
            }
        }
    }
    return false;
}

// 주어진 방향으로 5개의 돌이 연속되는지 확인하는 함수
function checkDirection(row, col, rowDir, colDir, player) {
    let count = 0;
    for (let i = 0; i < 5; i++) {
        let r = row + i * rowDir;
        let c = col + i * colDir;
        if (r >= 0 && r < 19 && c >= 0 && c < 19 && board[r][c] === player) {
            count++;
        } else {
            break;
        }
    }
    return count === 5;
}

// Minimax 알고리즘 (AI와 사용자)
function minimax(depth, isMaximizingPlayer) {
    if (depth === 0 || checkWin(1) || checkWin(-1)) {
        return evaluateBoard();
    }

    if (isMaximizingPlayer) {
        let maxEval = -Infinity;
        for (let row = 0; row < 19; row++) {
            for (let col = 0; col < 19; col++) {
                if (board[row][col] === 0) {
                    board[row][col] = -1;  // AI의 차례
                    let eval = minimax(depth - 1, false);
                    board[row][col] = 0;  // 되돌리기
                    maxEval = Math.max(maxEval, eval);
                }
            }
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (let row = 0; row < 19; row++) {
            for (let col = 0; col < 19; col++) {
                if (board[row][col] === 0) {
                    board[row][col] = 1;  // 사용자의 차례
                    let eval = minimax(depth - 1, true);
                    board[row][col] = 0;  // 되돌리기
                    minEval = Math.min(minEval, eval);
                }
            }
        }
        return minEval;
    }
}

// 보드 평가 함수
function evaluateBoard() {
    if (checkWin(-1)) {
        return 1;  // AI가 이겼을 경우
    } else if (checkWin(1)) {
        return -1;  // 사용자가 이겼을 경우
    }
    return 0;  // 무승부
}

// AI가 최적의 수를 계산하여 두기
function aiMove() {
    let bestMove = null;
    let bestValue = -Infinity;

    for (let row = 0; row < 19; row++) {
        for (let col = 0; col < 19; col++) {
            if (board[row][col] === 0) {
                board[row][col] = -1;  // AI 차례
                let moveValue = minimax(3, false);  // 깊이는 3으로 설정 (깊이는 조정 가능)
                board[row][col] = 0;  // 되돌리기

                if (moveValue > bestValue) {
                    bestValue = moveValue;
                    bestMove = { row, col };
                }
            }
        }
    }

    // AI의 최적의 수를 보드에 놓기
    if (bestMove) {
        board[bestMove.row][bestMove.col] = -1;
        printBoard();
        checkEndGame();
    }
}

// 사용자의 턴 (돌을 놓을 때)
function userMove(row, col) {
    if (board[row][col] === 0) {
        board[row][col] = 1;
        printBoard();
        checkEndGame();
        aiMove();  // AI의 턴
    }
}

// 게임 종료 판별
function checkEndGame() {
    if (checkWin(1)) {
        alert("사용자가 승리했습니다!");
    } else if (checkWin(-1)) {
        alert("AI가 승리했습니다!");
    }
}
