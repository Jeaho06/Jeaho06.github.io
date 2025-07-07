// js/game.js

// --- 필요한 함수들을 다른 모듈에서 import ---
import { createBoardUI, placeStone, removeStone, logMove, logReason, showEndGameMessage, getString } from './ui.js';
import { db, updateUserStats } from './firebase.js';

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
 * main.js가 유저의 로그인 상태를 game.js에 알려주기 위한 함수
 */
export function initGameState(user, uData, gData) {
    currentUser = user;
    userData = uData;
    guestData = gData;
}

// --- 이하 원본 script.js의 모든 게임 관련 함수 (버그 수정 포함) ---

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

// js/game.js 파일의 setupBoardClickListener 함수를 아래 코드로 교체하세요.

export function setupBoardClickListener() {
  const boardElement = document.getElementById("game-board");
  const newBoardElement = boardElement.cloneNode(true);
  boardElement.parentNode.replaceChild(newBoardElement, boardElement);

  newBoardElement.addEventListener('click', (event) => {
    if (isAITurn || gameOver) return;
    const rect = newBoardElement.getBoundingClientRect();
    const col = Math.round((event.clientX - rect.left - gridSize / 2) / gridSize);
    const row = Math.round((event.clientY - rect.top - gridSize / 2) / gridSize);

    if (col < 0 || col >= 19 || row < 0 || row >= 19) return;
    
    // [수정] 사용자가 폭탄을 클릭하는 로직을 제거합니다.
    // if (bombState.isArmed && bombState.col === col && bombState.row === row) {
    //     detonateBomb();
    //     return;
    // }

    if (board[row][col] !== 0) {
        logReason(getString('user_title'), `[${convertCoord(col, row)}] ${getString('system_already_placed')}`);
        return; 
    }
    
    board[row][col] = 1;
    const isWinningMove = checkWin(board, 1);
    board[row][col] = 0;
    
    if (isWinningMove && !isDestinyDenialUsed && document.getElementById('toggle-destiny-denial').checked) {
        isDestinyDenialUsed = true; board[row][col] = 3; 
        const deniedSpot = document.createElement("div"); deniedSpot.className = "denied-spot";
        deniedSpot.style.left = `${col * gridSize + gridSize / 2}px`; deniedSpot.style.top = `${row * gridSize + gridSize / 2}px`;
        newBoardElement.appendChild(deniedSpot);
        const deniedCoord = convertCoord(col, row);
        logMove(++moveCount, `${getString('ai_title')}: ${getString('cheat_veto')}!!`);
        logReason(getString('ai_title'), getString('ai_veto_reason', {coord: deniedCoord}));
        return; 
    }
    
    if (isForbiddenMove(col, row, 1)) { logReason(getString('user_title'), getString('system_forbidden')); return; }
    
    board[row][col] = 1; 
    placeStone(col, row, 'black'); 
    playSound("Movement.mp3");
    logMove(++moveCount, `${getString('user_title')}: ${convertCoord(col, row)}??`);
    isFirstMove = false; 
    lastMove = { col, row };
    
    if (checkWin(board, 1)) { endGame(getString('system_user_win')); return; }
    if (checkDraw()) { endGame(getString('system_draw')); return; }
    
    isAITurn = true;
    setTimeout(aiMove, 500);
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

// js/game.js 파일의 aiMove 함수를 아래 코드로 교체하세요.

function aiMove() {
  if (gameOver) return;
  
  // [수정] AI 턴이 시작될 때 폭탄이 설치되어 있으면 즉시 기폭시키는 로직을 복구합니다.
  if (bombState.isArmed) {
    detonateBomb();
    return;
  }

  const willCheat = Math.random() < cheatProbability && !isFirstMove && lastMove;
  if (willCheat) {
    const availableCheats = [];
    if (document.getElementById('toggle-bomb').checked) availableCheats.push(placeBomb);
    if (document.getElementById('toggle-double-move').checked) availableCheats.push(performDoubleMove);
    if (document.getElementById('toggle-swap').checked) availableCheats.push(performStoneSwap);
    if (availableCheats.length > 0) {
      const chosenCheat = availableCheats[Math.floor(Math.random() * availableCheats.length)];
      const actionResult = chosenCheat();
      if(actionResult) return;
    }
  }
  performNormalMove();
}
function performNormalMove() {
    const move = findBestMove();
    if (move && board[move.row][move.col] === 0) {
        const aiCoord = convertCoord(move.col, move.row);
        board[move.row][move.col] = -1;
        placeStone(move.col, move.row, 'white');
        playSound("Movement.mp3");
        moveCount++;
        logMove(moveCount, `${getString('ai_title')}: ${aiCoord}`);
        logReason(getString('ai_title'), `AI가 ${aiCoord}에 돌을 놓았습니다.`);
        isFirstMove = false; lastMove = { col: move.col, row: move.row };
        if (checkWin(board, -1)) { endGame(getString('system_ai_win')); }
        else if (checkDraw()) { endGame(getString('system_draw')); }
        else { isAITurn = false; }
    } else { isAITurn = false; }
}

function detonateBomb() {
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
                    board[r][c] = 0; // [수정] 원본 버그 수정을 위해 이 줄을 추가합니다.
                }
            }
        }
        bombEffect.remove();
        bombState = { isArmed: false, col: null, row: null };
        if (checkWin(board, 1)) { endGame(getString('system_user_win')); } 
        else if (checkWin(board, -1)) { endGame(getString('system_ai_win')); }
        else { isAITurn = false; }
    }, 500);
}

function placeBomb() {
    const move = findBestBombLocation();
    if (move) {
        board[move.row][move.col] = 2;
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
    const userStone = lastMove;
    const aiStoneToSwap = findBestSwapTarget();
    if (aiStoneToSwap) {
        const userCoord = convertCoord(userStone.col, userStone.row);
        const aiCoord = convertCoord(aiStoneToSwap.col, aiStoneToSwap.row);
        logMove(++moveCount, `${getString('ai_title')}: ${userCoord}↔${aiCoord}!!`);
        logReason(getString('ai_title'), getString('ai_swap_reason', { userCoord, aiCoord }));
        removeStone(userStone.col, userStone.row);
        removeStone(aiStoneToSwap.col, aiStoneToSwap.row);
        setTimeout(() => {
            board[userStone.row][userStone.col] = -1;
            placeStone(userStone.col, userStone.row, 'white');
            board[aiStoneToSwap.row][aiStoneToSwap.col] = 1;
            placeStone(aiStoneToSwap.col, aiStoneToSwap.row, 'black');
            playSound("Movement.mp3");
            if (checkWin(board, -1)) { endGame(getString('system_ai_win')); }
            else { isAITurn = false; }
        }, 500);
        return true;
    }
    return false;
}

function findBestBombLocation() {
    let bestLocation = null; let maxScore = -Infinity;
    for (let r = 0; r < 19; r++) {
        for (let c = 0; c < 19; c++) {
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
    }
    return maxScore > 0 ? bestLocation : null;
}

function findBestSwapTarget() {
    let bestSwap = { stoneToSwap: null, netAdvantage: -Infinity };
    if (!lastMove) return null;
    for (let r = 0; r < 19; r++) for (let c = 0; c < 19; c++) {
        if (board[r][c] === -1) {
            const aiStone = { col: c, row: r };
            const aiGain = calculateScore(lastMove.col, lastMove.row, -1).totalScore;
            const userGain = calculateScore(aiStone.col, aiStone.row, 1).totalScore;
            const netAdvantage = aiGain - userGain;
            if (netAdvantage > bestSwap.netAdvantage) bestSwap = { stoneToSwap: aiStone, netAdvantage };
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
    for (let r = 0; r < 19; r++) for (let c = 0; c < 19; c++) {
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

function convertCoord(col, row) { return String.fromCharCode(65 + col) + (row + 1); }
function playSound(soundFile) { const audio = new Audio(`sounds/${soundFile}`); audio.play(); }
function checkDraw() { return moveCount >= 361; }