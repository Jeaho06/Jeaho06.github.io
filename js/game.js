// js/game.js
import { updateUserStats } from './firebase.js';
import { placeStone, removeStone, logMove, logReason, showEndGameMessage, getString, createBoardUI } from './ui.js';

// --- 게임 상태 변수 ---
let board;
let isAITurn;
let lastMove;
let isFirstMove;
let moveCount;
let gameOver;
let isDestinyDenialUsed;
let bombState;
let cheatProbability = 0.4;
const gridSize = 30; // ui.js와 동일한 값 유지

export function resetGame() {
    board = Array(19).fill(null).map(() => Array(19).fill(0));
    isAITurn = false;
    lastMove = null;
    isFirstMove = true;
    moveCount = 0;
    gameOver = false;
    isDestinyDenialUsed = false;
    bombState = { isArmed: false, col: null, row: null };

    document.getElementById('move-log').innerHTML = '';
    document.getElementById('reasoning-log').innerHTML = '';
    
    createBoardUI();
}

export function handleBoardClick(event, userState) {
    if (isAITurn || gameOver) return;
    const boardElement = document.getElementById("game-board");
    const rect = boardElement.getBoundingClientRect();
    const col = Math.round((event.clientX - rect.left - gridSize / 2) / gridSize);
    const row = Math.round((event.clientY - rect.top - gridSize / 2) / gridSize);

    if (col < 0 || col >= 19 || row < 0 || row >= 19) return;
    
    // 금수점 클릭 방지
    if (board[row][col] === 3) {
        logReason(getString('user_title'), getString('system_denied_spot'));
        return;
    }

    // AI의 거부권 반칙 로직
    board[row][col] = 1;
    const isWinningMove = checkWin(board, 1);
    board[row][col] = 0; // 원상복구

    if (isWinningMove && !isDestinyDenialUsed && document.getElementById('toggle-destiny-denial').checked) {
        isDestinyDenialUsed = true;
        board[row][col] = 3; // 금수점으로 설정
        
        const deniedSpot = document.createElement("div");
        deniedSpot.className = "denied-spot";
        deniedSpot.style.left = `${col * gridSize + gridSize / 2}px`;
        deniedSpot.style.top = `${row * gridSize + gridSize / 2}px`;
        boardElement.appendChild(deniedSpot);

        const deniedCoord = convertCoord(col, row);
        logMove(++moveCount, `${getString('ai_title')}: ${getString('cheat_veto')}!!`);
        logReason(getString('ai_title'), getString('ai_veto_reason', {coord: deniedCoord}));
        return;
    }
    
    // 이미 돌이 있는 경우
    if (board[row][col] !== 0) return;

    // 정상적인 수 처리
    placeUserStone(col, row, userState);
}

function placeUserStone(col, row, userState) {
    if (isForbiddenMove(col, row, 1)) {
        logReason(getString('user_title'), getString('system_forbidden'));
        return;
    }
    
    board[row][col] = 1;
    placeStone(col, row, 'black');
    playSound("Movement.mp3");
    moveCount++;
    lastMove = { col, row };
    logMove(moveCount, `${getString('user_title')}: ${convertCoord(col, row)}`);

    if (checkWin(board, 1)) {
        endGame('win', userState);
        return;
    }
    if (checkDraw()) {
        endGame('draw', userState);
        return;
    }
    isAITurn = true;
    setTimeout(() => aiMove(userState), 500);
}

// --- AI 로직 (모든 반칙 포함) ---

function aiMove(userState) {
    if (gameOver) return;
    if (bombState.isArmed) {
        detonateBomb(userState);
        return;
    }
    const willCheat = Math.random() < cheatProbability && !isFirstMove && lastMove;
    if (willCheat) {
        const availableCheats = [];
        if (document.getElementById('toggle-bomb').checked) availableCheats.push(() => placeBomb(userState));
        if (document.getElementById('toggle-double-move').checked) availableCheats.push(() => performDoubleMove(userState));
        if (document.getElementById('toggle-swap').checked) availableCheats.push(() => performStoneSwap(userState));
        
        if (availableCheats.length > 0) {
            const chosenCheat = availableCheats[Math.floor(Math.random() * availableCheats.length)];
            const actionResult = chosenCheat();
            if (actionResult) return; // 반칙 성공 시 여기서 종료
        }
    }
    // 반칙을 안했거나 실패하면 일반 수 실행
    performNormalMove(userState);
}

function performNormalMove(userState, predefinedMove = null) {
    const move = predefinedMove || findBestMove();
    if (move && board[move.row][move.col] === 0) {
        const myContext = calculateScore(move.col, move.row, -1);
        const opponentContext = calculateScore(move.col, move.row, 1);
        let reasonKey = 'reason_default';
        if (myContext.highestPattern >= 1000000) reasonKey = 'reason_win';
        else if (opponentContext.highestPattern >= 1000000) reasonKey = 'reason_block_win';
        else if (myContext.highestPattern >= 100000) reasonKey = 'reason_attack_4';
        else if (opponentContext.highestPattern >= 100000) reasonKey = 'reason_block_4';
        else if (opponentContext.highestPattern >= 5000) reasonKey = 'reason_block_3';
        else if (myContext.highestPattern >= 5000) reasonKey = 'reason_attack_3';
        
        const reason = getString(reasonKey);
        const aiCoord = convertCoord(move.col, move.row);
        board[move.row][move.col] = -1;
        placeStone(move.col, move.row, 'white');
        playSound("Movement.mp3");
        moveCount++;
        logMove(moveCount, `${getString('ai_title')}: ${aiCoord}`);
        logReason(getString('ai_title'), getString('ai_reason_template', { reason: reason, coord: aiCoord }));
        isFirstMove = false;
        lastMove = { col: move.col, row: move.row };
        
        if (checkWin(board, -1)) {
            endGame('loss', userState);
        } else if (checkDraw()) {
            endGame('draw', userState);
        } else {
            isAITurn = false;
        }
        return { isAsync: false };
    }
    isAITurn = false;
    return null;
}

function placeBomb(userState) {
    const move = findBestBombLocation();
    if (move) {
        board[move.row][move.col] = 2; // 2는 폭탄
        bombState = { isArmed: true, col: move.col, row: move.row };
        placeStone(move.col, move.row, 'bomb');
        playSound("tnt_installation.mp3");
        const bombCoord = convertCoord(move.col, move.row);
        logMove(++moveCount, `${getString('ai_title')}: ${bombCoord}!!`);
        logReason(getString('ai_title'), getString('ai_bomb_place_reason', { coord: bombCoord }));
        isAITurn = false;
        return true;
    }
    return false;
}

function detonateBomb(userState) {
    const center = bombState;
    const centerCoord = convertCoord(center.col, center.row);
    logMove(++moveCount, `${getString('ai_title')}: ${centerCoord}💥!!`);
    logReason(getString('ai_title'), getString('ai_bomb_detonate_reason', { coord: centerCoord }));
    playSound("tnt_explosion.mp3");

    const boardElement = document.getElementById("game-board");
    const bombEffect = document.createElement("div");
    bombEffect.className = "bomb-effect";
    bombEffect.style.left = `${center.col * gridSize + gridSize / 2}px`;
    bombEffect.style.top = `${center.row * gridSize + gridSize / 2}px`;
    boardElement.appendChild(bombEffect);

    setTimeout(() => {
        for (let r = center.row - 1; r <= center.row + 1; r++) {
            for (let c = center.col - 1; c <= center.col + 1; c++) {
                if (r >= 0 && r < 19 && c >= 0 && c < 19) {
                    removeStone(c, r);
                    board[r][c] = 0;
                }
            }
        }
        bombEffect.remove();
        bombState = { isArmed: false, col: null, row: null };
        if (checkWin(board, 1)) {
            endGame('win', userState);
        } else {
            isAITurn = false;
        }
    }, 500);
}

function performDoubleMove(userState) {
    performNormalMove(userState);
    if (gameOver) return true;

    setTimeout(() => {
        if (gameOver) return;
        performNormalMove(userState); // 두 번째 수
    }, 800);
    return true;
}

function performStoneSwap(userState) {
    if (!lastMove) return false;
    const userStone = lastMove;
    const aiStoneToSwap = findBestSwapTarget();

    if (aiStoneToSwap) {
        const userCoord = convertCoord(userStone.col, userStone.row);
        const aiCoord = convertCoord(aiStoneToSwap.col, aiStoneToSwap.row);
        logMove(++moveCount, `${getString('ai_title')}: ${userCoord}↔${aiCoord}!!`);
        logReason(getString('ai_title'), getString('ai_swap_reason', { userCoord: userCoord, aiCoord: aiCoord }));
        
        removeStone(userStone.col, userStone.row);
        removeStone(aiStoneToSwap.col, aiStoneToSwap.row);
        
        board[userStone.row][userStone.col] = -1;
        placeStone(userStone.col, userStone.row, 'white');
        
        board[aiStoneToSwap.row][aiStoneToSwap.col] = 1;
        placeStone(aiStoneToSwap.col, aiStoneToSwap.row, 'black');
        
        playSound("Movement.mp3");
        
        if (checkWin(board, -1)) {
            endGame('loss', userState);
        } else {
            isAITurn = false;
        }
        return true;
    }
    return false;
}


// --- 게임 규칙 및 AI 계산 로직 ---
async function endGame(result, userState) {
    if (gameOver) return;
    gameOver = true;
    const { currentUser, userData, guestData } = userState;
    const currentData = currentUser ? userData : guestData;
    let messageKey = '';

    if (result === 'win') {
        messageKey = 'system_user_win';
        currentData.stats.wins++;
    } else if (result === 'loss') {
        messageKey = 'system_ai_win';
        currentData.stats.losses++;
    } else { // draw
        messageKey = 'system_draw';
        currentData.stats.draws++;
    }

    showEndGameMessage(getString(messageKey));

    if (currentUser) {
        await updateUserStats(currentUser.uid, currentData.stats);
    } else {
        localStorage.setItem('omok_guestData', JSON.stringify(currentData));
    }
}

function checkWin(board, player) {
    for (let y = 0; y < 19; y++) {
        for (let x = 0; x < 19; x++) {
            if (board[y][x] === player) {
                const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
                for (const [dx, dy] of directions) {
                    let count = 1;
                    for (let i = 1; i < 5; i++) {
                        const nx = x + i * dx, ny = y + i * dy;
                        if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === player) count++; else break;
                    }
                    if (count >= 5) return true;
                }
            }
        }
    }
    return false;
}

function checkDraw() { return moveCount >= 361; }

function isForbiddenMove(x, y, player) {
    if (player !== 1) return false;
    board[y][x] = player;
    let openThrees = 0;
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dx, dy] of directions) {
        if (calculateScoreForLine(x, y, dx, dy, player) === 5000) openThrees++;
    }
    board[y][x] = 0;
    return openThrees >= 2;
}


function findBestMove() {
  let bestMove = null; let bestScore = -Infinity;
  const relevantMoves = getRelevantMoves();
  for (const move of relevantMoves) {
    if (board[move.row][move.col] === 0) {
        const myScore = calculateScore(move.col, move.row, -1).totalScore;
        const opponentScore = calculateScore(move.col, move.row, 1).totalScore;
        const totalScore = myScore + opponentScore;
        if (totalScore > bestScore) { bestScore = totalScore; bestMove = move; }
    }
  }
  return bestMove || (relevantMoves.length > 0 ? relevantMoves[0] : { col: 9, row: 9 });
}

function getRelevantMoves() {
    const relevantMoves = new Set();
    if (isFirstMove || !lastMove) return [{ col: 9, row: 9 }];
    const range = 2;
    for (let r = 0; r < 19; r++) {
        for (let c = 0; c < 19; c++) {
            if (board[r][c] !== 0) {
                for (let i = -range; i <= range; i++) {
                    for (let j = -range; j <= range; j++) {
                        const nr = r + i, nc = c + j;
                        if (nr >= 0 && nr < 19 && nc >= 0 && nc < 19 && board[nr][nc] === 0) {
                            relevantMoves.add(`${nr},${nc}`);
                        }
                    }
                }
            }
        }
    }
    if (relevantMoves.size === 0 && lastMove) {
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue;
            const nr = lastMove.row + i, nc = lastMove.col + j;
            if (nr >= 0 && nr < 19 && nc >= 0 && nc < 19 && board[nr][nc] === 0) relevantMoves.add(`${nr},${nc}`);
        }
    }
    return Array.from(relevantMoves).map(s => { const [row, col] = s.split(','); return { col: parseInt(col), row: parseInt(row) }; });
}

function calculateScore(x, y, player) {
    let totalScore = 0, highestPattern = 0;
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dx, dy] of directions) {
        const score = calculateScoreForLine(x, y, dx, dy, player);
        if (score > highestPattern) highestPattern = score;
        totalScore += score;
    }
    return { totalScore, highestPattern };
}

function calculateScoreForLine(x, y, dx, dy, player) {
    let count = 1, openEnds = 0;
    // 정방향
    for (let i = 1; i < 5; i++) {
        const nx = x + i * dx, ny = y + i * dy;
        if (nx < 0 || ny < 0 || nx >= 19 || ny >= 19 || board[ny][nx] === -player) { openEnds++; break; }
        if (board[ny][nx] === player) count++; else { openEnds++; break; }
    }
    // 역방향
    for (let i = 1; i < 5; i++) {
        const nx = x - i * dx, ny = y - i * dy;
        if (nx < 0 || ny < 0 || nx >= 19 || ny >= 19 || board[ny][nx] === -player) { openEnds++; break; }
        if (board[ny][nx] === player) count++; else { openEnds++; break; }
    }
    if (count >= 5) return 1000000;
    if (count === 4) return openEnds === 2 ? 100000 : 10000;
    if (count === 3) return openEnds === 2 ? 5000 : 500;
    if (count === 2) return openEnds === 2 ? 100 : 10;
    if (count === 1 && openEnds === 2) return 1;
    return 0;
}

function findBestBombLocation() {
    let bestLocation = null; let maxScore = -Infinity;
    for (let r = 0; r < 19; r++) for (let c = 0; c < 19; c++) {
        if (board[r][c] === 0) {
            let currentScore = 0;
            for (let y = r - 1; y <= r + 1; y++) for (let x = c - 1; x <= c + 1; x++) {
                if (y >= 0 && y < 19 && x >= 0 && x < 19) {
                    if (board[y][x] === 1) { currentScore += 3; if (isCriticalStone(x, y, 1)) currentScore += 5; }
                    else if (board[y][x] === -1) currentScore -= 1;
                }
            }
            if (currentScore > maxScore) { maxScore = currentScore; bestLocation = { col: c, row: r }; }
        }
    }
    if (maxScore <= 0) return null;
    return bestLocation;
}

function findBestSwapTarget() {
    let bestSwap = { stoneToSwap: null, netAdvantage: -Infinity };
    for (let r = 0; r < 19; r++) for (let c = 0; c < 19; c++) {
        if (board[r][c] === -1) {
            const aiStone = { col: c, row: r };
            const aiGain = calculateScore(lastMove.col, lastMove.row, -1).totalScore;
            const userGain = calculateScore(aiStone.col, aiStone.row, 1).totalScore;
            const netAdvantage = aiGain - userGain;
            if (netAdvantage > bestSwap.netAdvantage) {
                bestSwap = { stoneToSwap: aiStone, netAdvantage: netAdvantage };
            }
        }
    }
    return bestSwap.stoneToSwap;
}

function isCriticalStone(x, y, player) {
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dx, dy] of directions) {
        let count = 1;
        for(let i=1; i<4; i++){ const nx = x + i * dx, ny = y + i * dy; if(nx<0||nx>=19||ny<0||ny>=19||board[ny][nx] !== player) break; count++;}
        for(let i=1; i<4; i++){ const nx = x - i * dx, ny = y - i * dy; if(nx<0||nx>=19||ny<0||ny>=19||board[ny][nx] !== player) break; count++;}
        if (count >= 3) return true;
    }
    return false;
}

function convertCoord(col, row) { return String.fromCharCode(65 + col) + (row + 1); }

function playSound(soundFile) {
    const audio = new Audio(`sounds/${soundFile}`);
    audio.play();
}