// js/game.js
// --- 'ui.js'와 'firebase.js'에서 필요한 함수들을 import ---
import { createBoardUI, placeStone, removeStone, logMove, logReason, showEndGameMessage, getString } from './ui.js';
import { db, updateUserStats } from './firebase.js';
import { doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 원본 script.js의 전역 변수들을 모듈의 최상위 스코프로 이동 ---
let board;
let isAITurn;
let lastMove;
let isFirstMove;
let moveCount;
let gameOver;
let isDestinyDenialUsed;
let bombState;
let cheatProbability = 0.4;
const gridSize = 30;

// main.js에서 현재 유저 상태를 받아오기 위한 변수
let currentUser, userData, guestData;

/**
 * main.js에서 유저의 로그인 상태가 변경될 때마다 이 함수를 호출하여
 * game.js가 현재 유저 정보를 알 수 있도록 합니다.
 * @param {object} user - Firebase auth 객체
 * @param {object} uData - Firestore 유저 데이터
 * @param {object} gData - 게스트 데이터
 */
export function initGameState(user, uData, gData) {
    currentUser = user;
    userData = uData;
    guestData = gData;
}

// --- 원본 script.js의 게임 관련 함수들을 그대로 복사 ---

export function resetGame() {
    board = Array(19).fill(null).map(() => Array(19).fill(0));
    isAITurn = false;
    lastMove = null;
    isFirstMove = true;
    moveCount = 0;
    isDestinyDenialUsed = false;
    bombState = { isArmed: false, col: null, row: null };
    gameOver = false;
    document.getElementById('move-log').innerHTML = '';
    document.getElementById('reasoning-log').innerHTML = '';
    createBoardUI();
}

export function setupBoardClickListener() {
  const boardElement = document.getElementById("game-board");
  boardElement.addEventListener('click', (event) => {
    if (isAITurn || gameOver) return;
    const rect = boardElement.getBoundingClientRect();
    const closestX = Math.round((event.clientX - rect.left - gridSize / 2) / gridSize);
    const closestY = Math.round((event.clientY - rect.top - gridSize / 2) / gridSize);

    if (closestX < 0 || closestX >= 19 || closestY < 0 || closestY >= 19) return;
    
    if (board[closestY][closestX] === 3) {
      logReason(getString('user_title'), getString('system_denied_spot')); return;
    }
    
    board[closestY][closestX] = 1;
    const isWinningMove = checkWin(board, 1);
    board[closestY][closestX] = 0;
    
    if (isWinningMove && !isDestinyDenialUsed && document.getElementById('toggle-destiny-denial').checked) {
        isDestinyDenialUsed = true; board[closestY][closestX] = 3; 
        const deniedSpot = document.createElement("div"); deniedSpot.className = "denied-spot";
        deniedSpot.style.left = `${closestX * gridSize + gridSize / 2}px`; deniedSpot.style.top = `${closestY * gridSize + gridSize / 2}px`;
        boardElement.appendChild(deniedSpot);
        const deniedCoord = convertCoord(closestX, closestY);
        logMove(++moveCount, `${getString('ai_title')}: ${getString('cheat_veto')}!!`);
        logReason(getString('ai_title'), getString('ai_veto_reason', {coord: deniedCoord}));
        return; 
    }
    
    if (board[closestY][closestX] !== 0) return;
    if (isForbiddenMove(closestX, closestY, 1)) { logReason(getString('user_title'), getString('system_forbidden')); return; }
    
    board[closestY][closestX] = 1; 
    placeStone(closestX, closestY, 'black'); 
    playSound("Movement.mp3");
    logMove(++moveCount, `${getString('user_title')}: ${convertCoord(closestX, closestY)}??`);
    isFirstMove = false; 
    lastMove = { col: closestX, row: closestY };
    
    if (checkWin(board, 1)) { endGame(getString('system_user_win')); return; }
    if (checkDraw()) { endGame(getString('system_draw')); return; }
    
    isAITurn = true;
    setTimeout(aiMove, 1000);
  });
}

async function endGame(message) {
    if (gameOver) return;
    gameOver = true;
    showEndGameMessage(message);
    logReason("시스템", message);

    const isUserWin = message === getString('system_user_win');
    const isDraw = message === getString('system_draw');
    const currentData = currentUser ? userData : guestData;

    if (isUserWin) currentData.stats.wins++;
    else if (isDraw) currentData.stats.draws++;
    else currentData.stats.losses++;
    
    if (currentUser) {
        await updateUserStats(currentUser.uid, currentData.stats);
    } else {
        localStorage.setItem('omok_guestData', JSON.stringify(currentData));
    }
}

function aiMove() {
  if (gameOver) return;
  if (bombState.isArmed) { detonateBomb(); return; }
  let moveAction;
  const willCheat = Math.random() < cheatProbability && !isFirstMove && lastMove;
  if (willCheat) {
    const availableCheats = [];
    if (document.getElementById('toggle-bomb').checked) availableCheats.push(() => placeBomb());
    if (document.getElementById('toggle-double-move').checked) availableCheats.push(() => performDoubleMove());
    if (document.getElementById('toggle-swap').checked) availableCheats.push(() => performStoneSwap());
    if (availableCheats.length > 0) {
      const chosenCheat = availableCheats[Math.floor(Math.random() * availableCheats.length)];
      const actionResult = chosenCheat();
      if(actionResult) return;
    }
  }
  performNormalMove();
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
    for (let i = 1; i < 5; i++) {
        const nx = x + i * dx, ny = y + i * dy;
        if (nx < 0 || ny < 0 || nx >= 19 || ny >= 19 || board[ny][nx] === -player) { openEnds++; break; }
        if (board[ny][nx] === player) count++; else { openEnds++; break; }
    }
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

function performNormalMove(predefinedMove = null) {
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
        logMove(++moveCount, `${getString('ai_title')}: ${aiCoord}`);
        logReason(getString('ai_title'), getString('ai_reason_template', { reason: reason, coord: aiCoord }));
        isFirstMove = false; lastMove = { col: move.col, row: move.row };
        
        if (checkWin(board, -1)) { endGame(getString('system_ai_win')); }
        else if (checkDraw()) { endGame(getString('system_draw')); }
        else { isAITurn = false; }
        return;
    }
    logReason(getString('ai_title'), getString('system_no_move'));
    isAITurn = false;
}

function checkWin(board, player) {
    for (let y = 0; y < 19; y++) for (let x = 0; x < 19; x++) {
        if (board[y][x] === player) {
            const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
            for (const [dx, dy] of directions) {
                let count = 1;
                for (let i = 1; i < 5; i++) {
                    const nx = x + i * dx, ny = y + i * dy;
                    if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === player) count++;
                    else break;
                }
                if (count >= 5) return true;
            }
        }
    }
    return false;
}

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

function placeBomb() {
    const move = findBestBombLocation();
    if (move) {
        board[move.row][move.col] = 2; bombState = { isArmed: true, col: move.col, row: move.row };
        placeStone(move.col, move.row, 'bomb'); playSound("tnt_installation.mp3");
        const bombCoord = convertCoord(move.col, move.row);
        logMove(++moveCount, `${getString('ai_title')}: ${bombCoord}!!`);
        logReason(getString('ai_title'), getString('ai_bomb_place_reason', { coord: bombCoord }));
        isAITurn = false; return true;
    }
    logReason(getString('ai_title'), getString('system_bomb_fail')); return false;
}

function detonateBomb() {
    const center = bombState; const centerCoord = convertCoord(center.col, center.row);
    logMove(++moveCount, `${getString('ai_title')}: ${centerCoord}💥!!`);
    logReason(getString('ai_title'), getString('ai_bomb_detonate_reason', { coord: centerCoord })); playSound("tnt_explosion.mp3");
    const boardElement = document.getElementById("game-board"); const bombEffect = document.createElement("div");
    bombEffect.className = "bomb-effect"; bombEffect.style.left = `${center.col * gridSize + gridSize / 2}px`; bombEffect.style.top = `${center.row * gridSize + gridSize / 2}px`;
    boardElement.appendChild(bombEffect);
    setTimeout(() => {
        for (let r = center.row - 1; r <= center.row + 1; r++) for (let c = center.col - 1; c <= center.col + 1; c++) { if (r >= 0 && r < 19 && c >= 0 && c < 19) removeStone(c, r); }
        bombEffect.remove(); bombState = { isArmed: false, col: null, row: null };
        if (checkWin(board, 1)) { endGame(getString('system_user_win')); } else { isAITurn = false; }
    }, 500);
}

function performDoubleMove() {
    performNormalMove();
    if (gameOver) return true;
    setTimeout(() => {
        if(gameOver) return;
        performNormalMove();
    }, 800);
    return true;
}

function performStoneSwap() {
    if (!lastMove) return false;
    const userStone = lastMove; let bestSwap = { stoneToSwap: null, netAdvantage: -Infinity };
    for (let r = 0; r < 19; r++) for (let c = 0; c < 19; c++) {
        if (board[r][c] === -1) {
            const aiStone = { col: c, row: r };
            const aiGain = calculateScore(userStone.col, userStone.row, -1).totalScore;
            const userGain = calculateScore(aiStone.col, aiStone.row, 1).totalScore;
            const netAdvantage = aiGain - userGain;
            if (netAdvantage > bestSwap.netAdvantage) bestSwap = { stoneToSwap: aiStone, netAdvantage: netAdvantage };
        }
    }
    if (bestSwap.stoneToSwap && bestSwap.netAdvantage > 5000) {
        const aiStoneToSwap = bestSwap.stoneToSwap;
        const userCoord = convertCoord(userStone.col, userStone.row), aiCoord = convertCoord(aiStoneToSwap.col, aiStoneToSwap.row);
        logMove(++moveCount, `${getString('ai_title')}: ${userCoord}↔${aiCoord}!!`);
        logReason(getString('ai_title'), getString('ai_swap_reason', { userCoord: userCoord, aiCoord: aiCoord }));
        removeStone(userStone.col, userStone.row); removeStone(aiStoneToSwap.col, aiStoneToSwap.row);
        setTimeout(() => {
            board[userStone.row][userStone.col] = -1; placeStone(userStone.col, userStone.row, 'white');
            board[aiStoneToSwap.row][aiStoneToSwap.col] = 1; placeStone(aiStoneToSwap.col, aiStoneToSwap.row, 'black');
            playSound("Movement.mp3");
            if (checkWin(board, -1)) endGame(getString('system_ai_win'));
            else isAITurn = false;
        }, 500);
        return true;
    }
    return false;
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

function checkDraw() { return moveCount >= 361; }