// c/Jeaho06.github.io/js/ai.js

// --- 설정 ---
// AI가 몇 수 앞을 내다볼지 결정합니다. 짝수로 설정하는 것이 좋습니다.
// 숫자가 클수록 AI가 똑똑해지지만, 계산 시간이 길어집니다. 4로 상향 조정합니다.
const SEARCH_DEPTH = 2; 

// js/ai.js

/**
 * AI의 수읽기 로직을 적용하여 최적의 수를 찾습니다. (메인 함수)
 * @param {Array} board - 현재 게임 보드
 * @param {number} moveCount - 현재까지 진행된 전체 수
 * @param {boolean} isFirstMove - 첫 수인지 여부
 * @param {object} lastMove - 마지막으로 둔 수의 좌표
 * @returns {{move: object, score: number, policy: Array}} - 최적의 수, 점수, 그리고 후보 수 목록
 */
export function findBestMoveAI(board, moveCount, isFirstMove, lastMove) {
    // 게임 전체에서 두 번째 수(moveCount === 1)일 때 특별 로직을 실행합니다.
    if (moveCount === 1 && lastMove) {
        const adjacentMoves = [];
        const { col, row } = lastMove;
        const directions = [
            [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]
        ];

        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (newRow >= 0 && newRow < 19 && newCol >= 0 && newCol < 19 && board[newRow][newCol] === 0) {
                adjacentMoves.push({ col: newCol, row: newRow });
            }
        }
        if (adjacentMoves.length > 0) {
            const randomMove = adjacentMoves[Math.floor(Math.random() * adjacentMoves.length)];
            // [수정] policy 키 추가
            return { move: randomMove, score: 0, policy: [] };
        }
    }

    let bestMove = null;
    let bestScore = -Infinity;
    const relevantMoves = getRelevantMoves(board, isFirstMove, lastMove);

    if (relevantMoves.length === 0) {
        // [수정] policy 키 추가
        return { move: { col: 9, row: 9 }, score: 0, policy: [] };
    }

    // 1. 각 후보 수에 대한 우선순위 점수를 계산합니다.
    const scoredMoves = relevantMoves.map(move => {
        const attackScore = calculateScore(move.col, move.row, -1, board).totalScore;
        const defenseScore = calculateScore(move.col, move.row, 1, board).totalScore;
        const priorityScore = (attackScore * 1.1) + defenseScore;
        return { move, score: priorityScore };
    });

    // 2. 계산된 우선순위 점수가 높은 순으로 후보 수 목록을 정렬합니다.
    scoredMoves.sort((a, b) => b.score - a.score);

    // 3. 정렬된 목록을 사용하여 미니맥스 탐색을 시작합니다.
    for (const { move } of scoredMoves) {
        const tempBoard = board.map(row => row.slice());
        tempBoard[move.row][move.col] = -1; // AI(백)의 수를 가상으로 둠

        const score = minimax(tempBoard, SEARCH_DEPTH - 1, -Infinity, Infinity, false);

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }
    
    // [수정] policy 키 포함하여 최종 반환
    return { 
        move: bestMove || relevantMoves[0], 
        score: bestScore,
        policy: scoredMoves 
    };
}

// ... (minimax, evaluateBoardScore 등 나머지 함수들은 그대로 유지) ...*/

/**
 * AI의 수읽기(Minimax)를 위한 재귀 함수
 * @param {Array} currentBoard - 현재 시뮬레이션 중인 보드 상태
 * @param {number} depth - 탐색할 깊이
 * @param {number} alpha - 알파-베타 가지치기를 위한 알파 값
 * @param {number} beta - 알파-베타 가지치기를 위한 베타 값
 * @param {boolean} isMaximizingPlayer - 현재 턴이 점수를 최대화하려는 플레이어(AI)인지 여부
 * @returns {number} 해당 노드의 평가 점수
 */
function minimax(currentBoard, depth, alpha, beta, isMaximizingPlayer) {
    if (depth === 0 || checkWin(currentBoard, 1) || checkWin(currentBoard, -1)) {
        return evaluateBoardScore(currentBoard);
    }

    const moves = getRelevantMoves(currentBoard, false, null);

    if (isMaximizingPlayer) { // AI의 턴 (점수 최대화)
        let maxEval = -Infinity;
        for (const move of moves) {
            const childBoard = currentBoard.map(row => row.slice());
            childBoard[move.row][move.col] = -1;
            const evalScore = minimax(childBoard, depth - 1, alpha, beta, false);
            maxEval = Math.max(maxEval, evalScore);
            alpha = Math.max(alpha, evalScore);
            if (beta <= alpha) break; // 알파 컷
        }
        return maxEval;
    } else { // 사용자의 턴 (점수 최소화)
        let minEval = Infinity;
        for (const move of moves) {
            if (isForbiddenMove(move.col, move.row, 1, currentBoard)) continue;
            
            const childBoard = currentBoard.map(row => row.slice());
            childBoard[move.row][move.col] = 1;
            const evalScore = minimax(childBoard, depth - 1, alpha, beta, true);
            minEval = Math.min(minEval, evalScore);
            beta = Math.min(beta, evalScore);
            if (beta <= alpha) break; // 베타 컷
        }
        return minEval;
    }
}

/**
 * 주어진 보드 상태의 전체적인 점수를 평가합니다. (수읽기의 마지막 단계에서 사용)
 * @param {Array} currentBoard - 평가할 보드
 * @returns {number} AI의 총점에서 사용자의 총점을 뺀 값
 */
function evaluateBoardScore(currentBoard) {
    if (checkWin(currentBoard, -1)) return 10000000; // AI 승리
    if (checkWin(currentBoard, 1)) return -10000000; // 사용자 승리

    let aiScore = 0;
    let userScore = 0;
    const aggressionFactor = 1.2;
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]]; // 가로, 세로, 대각선

    // 모든 칸을 시작점으로 하여 5칸 길이의 라인을 분석합니다.
    for (let r = 0; r < 19; r++) {
        for (let c = 0; c < 19; c++) {
            for (const [dr, dc] of directions) {
                let aiStones = 0;
                let userStones = 0;

                // 5칸 윈도우 내의 돌 개수를 셉니다.
                for (let i = 0; i < 5; i++) {
                    const nr = r + i * dr;
                    const nc = c + i * dc;

                    if (nr < 0 || nr >= 19 || nc < 0 || nc >= 19) {
                        aiStones = 0; userStones = 0; break; // 라인이 보드를 벗어나면 무효
                    }
                    if (currentBoard[nr][nc] === -1) aiStones++;
                    else if (currentBoard[nr][nc] === 1) userStones++;
                }

                // 한 라인에 AI와 사용자의 돌이 같이 있으면 위협적이지 않으므로 점수를 주지 않습니다.
                if (aiStones > 0 && userStones > 0) continue;

                if (aiStones > 0) aiScore += getPatternScore(aiStones);
                else if (userStones > 0) userScore += getPatternScore(userStones);
            }
        }
    }
    return (aiScore * aggressionFactor) - userScore;
}

/**
 * 5칸 라인 내의 돌 개수에 따라 패턴 점수를 반환하는 헬퍼 함수
 * @param {number} stoneCount - 라인 내의 돌 개수
 */
function getPatternScore(stoneCount) {
    switch (stoneCount) {
        case 4: return 10000; // 4개 연속 (곧 5목이 될 수 있는 강력한 위협)
        case 3: return 500;   // 3개 연속 (강한 위협)
        case 2: return 50;    // 2개 연속 (잠재적 위협)
        case 1: return 5;     // 1개 (위치적 이점)
        default: return 0;
    }
}


// --- 이하 수읽기 로직에 필요한 헬퍼 함수들 ---
// (game.js에도 동일한 함수들이 있지만, AI 모듈의 독립성을 위해 여기에 포함합니다)

// [삭제] findMoveInOpeningBook 함수를 제거합니다.

function getRelevantMoves(currentBoard, isFirst, lastPlayerMove) {
    const relevantMoves = new Set();
    if (isFirst) return [{ col: 9, row: 9 }];
    
    const range = 2;
    for (let r = 0; r < 19; r++) {
        for (let c = 0; c < 19; c++) {
            if (currentBoard[r][c] !== 0) {
                for (let i = -range; i <= range; i++) {
                    for (let j = -range; j <= range; j++) {
                        const nr = r + i, nc = c + j;
                        if (nr >= 0 && nr < 19 && nc >= 0 && nc < 19 && currentBoard[nr][nc] === 0) {
                            relevantMoves.add(`${nr},${nc}`);
                        }
                    }
                }
            }
        }
    }
    if (relevantMoves.size === 0) {
        return lastPlayerMove ? [{col: lastPlayerMove.col + 1, row: lastPlayerMove.row}] : [{ col: 9, row: 9 }];
    }
    return Array.from(relevantMoves).map(s => { const [row, col] = s.split(','); return { col: parseInt(col), row: parseInt(row) }; });
}

function calculateScore(x, y, player, currentBoard) {
    let totalScore = 0, highestPattern = 0;
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dx, dy] of directions) {
        const score = calculateScoreForLine(x, y, dx, dy, player, currentBoard);
        if (score > highestPattern) highestPattern = score;
        totalScore += score;
    }
    return { totalScore, highestPattern };
}

function calculateScoreForLine(x, y, dx, dy, player, currentBoard) {
    let count = 1;
    let openEnds = 0;
    for (let i = 1; i < 5; i++) {
        const nx = x + i * dx, ny = y + i * dy;
        if (nx < 0 || ny < 0 || nx >= 19 || ny >= 19 || currentBoard[ny][nx] === -player) break;
        if (currentBoard[ny][nx] === 0) { openEnds++; break; }
        count++;
    }
    for (let i = 1; i < 5; i++) {
        const nx = x - i * dx, ny = y - i * dy;
        if (nx < 0 || ny < 0 || nx >= 19 || ny >= 19 || currentBoard[ny][nx] === -player) break;
        if (currentBoard[ny][nx] === 0) { openEnds++; break; }
        count++;
    }
    if (count < 5 && openEnds === 0) return 0;
    if (count >= 5) return 1000000;
    if (count === 4) return openEnds === 2 ? 100000 : 10000;
    if (count === 3) return openEnds === 2 ? 5000 : 400;
    if (count === 2) return openEnds === 2 ? 100 : 10;
    if (count === 1 && openEnds === 2) return 1;
    return 0;
}

function checkWin(currentBoard, player) {
    for (let y = 0; y < 19; y++) {
        for (let x = 0; x < 19; x++) {
            if (currentBoard[y][x] === player) {
                const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
                for (const [dx, dy] of directions) {
                    let count = 1;
                    for (let i = 1; i < 5; i++) {
                        const nx = x + i * dx, ny = y + i * dy;
                        if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && currentBoard[ny][nx] === player) count++;
                        else break;
                    }
                    if (count >= 5) return true;
                }
            }
        }
    }
    return false;
}

function isForbiddenMove(x, y, player, currentBoard) {
    if (player !== 1) return false;
    const tempBoard = currentBoard.map(row => row.slice());
    tempBoard[y][x] = player;
    if (checkWin(tempBoard, player)) return false;
    let openThreeCount = 0;
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dx, dy] of directions) {
        if (checkOpenThree(x, y, dx, dy, tempBoard)) openThreeCount++;
    }
    return openThreeCount >= 2;
}

function checkOpenThree(x, y, dx, dy, board) {
    const player = board[y][x];
    let count = 1, openEnds = 0;
    let i = 1;
    while (true) {
        const nx = x + i * dx, ny = y + i * dy;
        if (nx < 0 || nx >= 19 || ny < 0 || ny >= 19 || board[ny][nx] !== player) {
            if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === 0) openEnds++;
            break;
        }
        count++; i++;
    }
    i = 1;
    while (true) {
        const nx = x - i * dx, ny = y - i * dy;
        if (nx < 0 || nx >= 19 || ny < 0 || ny >= 19 || board[ny][nx] !== player) {
            if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === 0) openEnds++;
            break;
        }
        count++; i++;
    }
    return count === 3 && openEnds === 2;
}