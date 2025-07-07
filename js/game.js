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
    
    // 새 게임 시 보드 UI 재생성
    createBoardUI();
}

export function handleBoardClick(event, userState) {
    if (isAITurn || gameOver) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const col = Math.round((event.clientX - rect.left - 15) / 30);
    const row = Math.round((event.clientY - rect.top - 15) / 30);

    if (col < 0 || col >= 19 || row < 0 || row >= 19 || board[row][col] !== 0) return;
    
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

// --- AI 전체 로직 ---

function aiMove(userState) {
    if (gameOver) return;
    if (bombState.isArmed) {
        detonateBomb(userState);
        return;
    }
    let moveAction;
    const willCheat = Math.random() < cheatProbability && !isFirstMove && lastMove;

    if (willCheat) {
        const availableCheats = [];
        if (document.getElementById('toggle-bomb').checked) availableCheats.push(() => placeBomb(userState));
        if (document.getElementById('toggle-double-move').checked) availableCheats.push(() => performDoubleMove(userState));
        if (document.getElementById('toggle-swap').checked) availableCheats.push(() => performStoneSwap(userState));
        
        if (availableCheats.length > 0) {
            const chosenCheat = availableCheats[Math.floor(Math.random() * availableCheats.length)];
            moveAction = chosenCheat;
        } else {
            moveAction = () => performNormalMove(userState);
        }
    } else {
        moveAction = () => performNormalMove(userState);
    }
    
    const actionResult = moveAction();

    // 반칙이 실패했거나, 비동기 반칙이 아닐 경우 일반 수 실행
    if (!actionResult || (actionResult && actionResult.isAsync === false)) {
        performNormalMove(userState);
    }
}

function performNormalMove(userState, predefinedMove = null) {
    const move = predefinedMove || findBestMove();
    if (move && board[move.row][move.col] === 0) {
        const aiCoord = convertCoord(move.col, move.row);
        board[move.row][move.col] = -1;
        placeStone(move.col, move.row, 'white');
        playSound("Movement.mp3");
        moveCount++;
        logMove(moveCount, `${getString('ai_title')}: ${aiCoord}`);
        logReason(getString('ai_title'), `AI가 ${aiCoord}에 돌을 놓았습니다.`); // 간단한 이유 로깅
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

// --- 반칙 로직 ---

function placeBomb(userState) {
    const move = findBestBombLocation();
    if (move) {
        board[move.row][move.col] = 2;
        bombState = { isArmed: true, col: move.col, row: move.row };
        placeStone(move.col, move.row, 'bomb');
        playSound("tnt_installation.mp3");
        const bombCoord = convertCoord(move.col, move.row);
        moveCount++;
        logMove(moveCount, `${getString('ai_title')}: ${bombCoord}!!`);
        logReason(getString('ai_title'), getString('ai_bomb_place_reason', { coord: bombCoord }));
        isAITurn = false;
        return { isAsync: true };
    }
    return false; // 폭탄 설치 실패
}

function detonateBomb(userState) {
    const center = bombState;
    const centerCoord = convertCoord(center.col, center.row);
    moveCount++;
    logMove(moveCount, `${getString('ai_title')}: ${centerCoord}💥!!`);
    logReason(getString('ai_title'), getString('ai_bomb_detonate_reason', { coord: centerCoord }));
    playSound("tnt_explosion.mp3");
    
    for (let r = center.row - 1; r <= center.row + 1; r++) {
        for (let c = center.col - 1; c <= center.col + 1; c++) {
            if (r >= 0 && r < 19 && c >= 0 && c < 19) {
                removeStone(c, r);
                board[r][c] = 0;
            }
        }
    }
    bombState = { isArmed: false, col: null, row: null };
    
    if (checkWin(board, 1)) {
        endGame('win', userState);
    } else {
        isAITurn = false;
    }
}

function performDoubleMove(userState) {
    performNormalMove(userState); // 첫 번째 수
    if (gameOver) return { isAsync: true };

    setTimeout(() => {
        if (gameOver) return;
        const move2 = findBestMove();
        if (move2 && board[move2.row][move2.col] === 0) {
            board[move2.row][move2.col] = -1;
            placeStone(move2.col, move2.row, 'white');
            playSound("Movement.mp3");
            const aiCoord2 = convertCoord(move2.col, move2.row);
            moveCount++;
            logMove(moveCount, `${getString('ai_title')}: ${aiCoord2}!!`);
            logReason(getString('ai_title'), getString('ai_double_move_2', { coord: aiCoord2 }));
            
            if (checkWin(board, -1)) {
                endGame('loss', userState);
            } else {
                isAITurn = false;
            }
        } else {
            isAITurn = false;
        }
    }, 800);
    return { isAsync: true };
}

function performStoneSwap(userState) {
    if (!lastMove) return false;
    const userStone = lastMove;
    const aiStoneToSwap = findBestSwapTarget();

    if (aiStoneToSwap) {
        const userCoord = convertCoord(userStone.col, userStone.row);
        const aiCoord = convertCoord(aiStoneToSwap.col, aiStoneToSwap.row);
        moveCount++;
        logMove(moveCount, `${getString('ai_title')}: ${userCoord}↔${aiCoord}!!`);
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
        return { isAsync: true };
    }
    return false;
}

// --- 게임 규칙 및 AI 계산 로직 ---
async function endGame(result, userState) {
    if (gameOver) return;
    gameOver = true;
    let messageKey = '';
    const { currentUser, userData, guestData } = userState;
    const currentData = currentUser ? userData : guestData;

    if (result === 'win') {
        messageKey = 'system_user_win';
        currentData.stats.wins++;
    } else if (result === 'loss') {
        messageKey = 'system_ai_win';
        currentData.stats.losses++;
    } else {
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
                if (checkLine(x, y, 1, 0, player) || checkLine(x, y, 0, 1, player) || 
                    checkLine(x, y, 1, 1, player) || checkLine(x, y, 1, -1, player)) {
                    return true;
                }
            }
        }
    }
    return false;
}

function checkLine(x, y, dx, dy, player) {
    for (let i = 0; i < 5; i++) {
        const nx = x + i * dx, ny = y + i * dy;
        if (nx < 0 || nx >= 19 || ny < 0 || ny >= 19 || board[ny][nx] !== player) return false;
    }
    return true;
}

function checkDraw() { return moveCount >= 361; }

function isForbiddenMove(x, y, player) { return false; }

function findBestMove() {
    for(let r = 0; r < 19; r++) for(let c = 0; c < 19; c++) if(board[r][c] === 0) return {row:r, col:c};
    return null;
}

function findBestBombLocation() {
    if(lastMove) return lastMove;
    return findBestMove();
}

function findBestSwapTarget() {
     for(let r = 0; r < 19; r++) for(let c = 0; c < 19; c++) if(board[r][c] === -1) return {row:r, col:c};
     return null;
}

function convertCoord(col, row) { return String.fromCharCode(65 + col) + (row + 1); }

function playSound(soundFile) {
    const audio = new Audio(`sounds/${soundFile}`);
    audio.play();
}