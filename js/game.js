// --- 필요한 함수들을 다른 모듈에서 import ---
import { createBoardUI, placeStone, removeStone, logMove, logReason, showEndGameMessage, getString, showLevelUpAnimation, convertCoord } from './ui.js';
import { db, updateUserGameResult } from './firebase.js';
import { findBestMoveAI } from './ai.js';
import { resetWinRate, updateWinRate } from './winRateManager.js';
import { executeDestinyDenial } from './cheats/destinyDenial.js';
import { executePlaceBomb } from './cheats/placeBomb.js';
import { executeDoubleMove } from './cheats/doubleMove.js';
import { executeStoneSwap } from './cheats/stoneSwap.js';

let board;
let isAITurn;
let lastMove;
let isFirstMove;
let moveCount;
let moveHistory;
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

export function resetGame() {
    board = Array(19).fill(null).map(() => Array(19).fill(0));
    isAITurn = false;
    lastMove = null;
    isFirstMove = true;
    moveCount = 0;
    moveHistory = [];
    isDestinyDenialUsed = false;
    bombState = { isArmed: false, col: null, row: null };
    gameOver = false;
    document.getElementById('move-log').innerHTML = '';
    document.getElementById('reasoning-log').innerHTML = '';
    createBoardUI();
    resetWinRate();
}


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
    
    if (board[row][col] !== 0) {
        logReason(getString('user_title'), `[${convertCoord(col, row)}] ${getString('system_already_placed')}`);
        return; 
    }
    
    // 거부권 확인을 위해 임시로 돌을 놓아봄
    board[row][col] = 1;
    const isWinningMove = checkWin(board, 1);
    board[row][col] = 0; // 확인 후 즉시 되돌림
    
    // [수정] '거부권' 로직을 모듈 호출로 변경
    const denialContext = { board, col, row, isWinningMove, isDestinyDenialUsed, moveCount };
    if (executeDestinyDenial(denialContext)) {
        isDestinyDenialUsed = true; // 스킬 사용 상태 업데이트
        moveCount++; // 수 카운트 업데이트
        return; // AI 턴으로 넘어가지 않고 사용자 턴 유지
    }
    
    if (isForbiddenMove(col, row, 1)) { logReason(getString('user_title'), getString('system_forbidden')); return; }
    board[row][col] = 1; 
    moveHistory.push({ col, row });
    placeStone(col, row, 'black'); 
    playSound("Movement.mp3");
    logMove(++moveCount, `${getString('user_title')}: ${convertCoord(col, row)}??`);
    isFirstMove = false; 
    lastMove = { col, row };
    
    if (checkWin(board, 1)) { endGame(getString('system_user_win')); return; }
    if (checkDraw()) { endGame(getString('system_draw')); return; }
    
    const { score: currentScore } = findBestMove();
    updateWinRate(currentScore, moveCount);

    isAITurn = true;
    setTimeout(aiMove, 500);
  });
}

// js/game.js

// ... (파일의 나머지 부분은 그대로 유지) ...

async function endGame(message) {
    if (gameOver) return;
    gameOver = true;
    
    let eventData = { message };

    const isUserWin = message === getString('system_user_win');
    const isDraw = message === getString('system_draw');
    const gameResult = isUserWin ? 'win' : (isDraw ? 'draw' : 'loss');

    if (currentUser) {
        const oldUserData = { ...userData }; 
        const result = await updateUserGameResult(currentUser.uid, gameResult, moveCount);
        
        if (result) {
            eventData.xpResult = result;
            eventData.oldUserData = oldUserData;

            // 1. 게임 종료 메시지를 먼저 표시합니다. (resetGame 콜백 전달)
            showEndGameMessage(eventData, resetGame);
            logReason("시스템", message);
            
            // 2. 만약 레벨업을 했다면, 그 위로 레벨업 연출을 덮어씌웁니다.
            if (result.didLevelUp) {
                console.log("레벨 업! 새로운 레벨:", result.newLevel);
                // z-index가 높기 때문에, 이 연출이 게임 종료 메시지보다 위에 나타납니다.
                showLevelUpAnimation(result.newLevel - 1, result.newLevel);
            }

        } else {
            // result가 없는 경우 (DB 업데이트 실패 등)에도 기본 메시지는 표시 (resetGame 콜백 전달)
            showEndGameMessage(eventData, resetGame);
            logReason("시스템", message);
        }
    } else {
        // 게스트일 경우
        const guestData = JSON.parse(localStorage.getItem('omok_guestData')) || { stats: { wins: 0, losses: 0, draws: 0 } };
        if (gameResult === 'win') guestData.stats.wins++;
        else if (gameResult === 'draw') guestData.stats.draws++;
        else guestData.stats.losses++;
        localStorage.setItem('omok_guestData', JSON.stringify(guestData));
        
        // 게스트일 때도 게임 종료 메시지를 표시합니다. (resetGame 콜백 전달)
        showEndGameMessage(eventData, resetGame);
        logReason("시스템", message);
    }
}

// ... (파일의 나머지 부분은 그대로 유지) ...

function aiMove() {
  if (gameOver) return;
    if (bombState.isArmed) {
    detonateBomb();
    return; 
  }

  const willCheat = Math.random() < cheatProbability && !isFirstMove && lastMove;
  if (willCheat) {
    const availableCheats = [];
    if (document.getElementById('toggle-bomb').checked) availableCheats.push(executePlaceBomb);
    if (document.getElementById('toggle-double-move').checked) availableCheats.push(executeDoubleMove);
    if (document.getElementById('toggle-swap').checked) availableCheats.push(executeStoneSwap);
    
    if (availableCheats.length > 0) {
      const chosenCheat = availableCheats[Math.floor(Math.random() * availableCheats.length)];
      
      const context = {
          board, bombState, lastMove, moveCount,
          isAITurn,
          performNormalMove: () => performNormalMove(), // 함수 참조 전달
          playSound, updateWinRate, findBestMove, endGame, checkWin, gameOver: () => gameOver,
          calculateScore, // [추가] stoneSwap 스킬에 필요한 함수들
          convertCoord, 
          removeStone, 
          placeStone,
          getString,
          logMove,
          logReason,
          passTurnToPlayer
        
      };
      
      if (chosenCheat(context)) {
          moveCount = context.moveCount; // 컨텍스트에서 변경되었을 수 있는 값 업데이트
          isAITurn = context.isAITurn;
          return; // 치트 사용 성공 시 일반 착수는 건너뜀
      }
    }
  }
  performNormalMove();
}

function passTurnToPlayer() {
    isAITurn = false;
}

function performNormalMove() {
    const { move, score } = findBestMove();
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
        moveHistory.push({ col: move.col, row: move.row });
        placeStone(move.col, move.row, 'white');
        playSound("Movement.mp3");
        logMove(++moveCount, `${getString('ai_title')}: ${aiCoord}`);
        logReason(getString('ai_title'), getString('ai_reason_template', { reason: reason, coord: aiCoord }));
        
        isFirstMove = false; 
        lastMove = { col: move.col, row: move.row };
        
        if (checkWin(board, -1)) { 
            endGame(getString('system_ai_win')); 
        } else if (checkDraw()) {
            endGame(getString('system_draw'));
        } else { 
            isAITurn = false; 
        }
        
        if (!gameOver) {
            const { score: newBoardScore } = findBestMove();
            updateWinRate(newBoardScore, moveCount);
        }
    } else {
        logReason(getString('ai_title'), getString('system_no_move'));
        isAITurn = false;
    }
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
    const gridSize = 30;
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
        bombState.isArmed = false;
        bombState.col = null;
        bombState.row = null;
        
        if (checkWin(board, 1)) { 
            endGame(getString('system_user_win')); 
        } else if (checkWin(board, -1)) { 
            endGame(getString('system_ai_win')); 
        } else {
            isAITurn = false;
            if (!gameOver) {
                const { score } = findBestMove();
                updateWinRate(score, moveCount);
            }
        }
    }, 500);
}

function findBestMove() {
    // AI의 두뇌 역할을 새로운 ai.js 모듈에 위임합니다.
    return findBestMoveAI(board, moveCount, isFirstMove, lastMove, moveHistory);
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

// [수정] AI가 바둑판의 가장자리를 올바르게 인식하도록 점수 계산 로직을 개선합니다.
function calculateScoreForLine(x, y, dx, dy, player) {
    let count = 1;
    let openEnds = 0;

    // 정방향(+) 탐색
    for (let i = 1; i < 5; i++) {
        const nx = x + i * dx, ny = y + i * dy;
        // 보드 밖이거나 상대방 돌을 만나면 라인이 막힘 (닫힌 끝)
        if (nx < 0 || ny < 0 || nx >= 19 || ny >= 19 || board[ny][nx] === -player) {
            break;
        }
        // 빈 칸을 만나면 라인이 열려있음 (열린 끝)
        if (board[ny][nx] === 0) {
            openEnds++;
            break;
        }
        // 우리 편 돌이면 계속 카운트
        count++;
    }

    // 역방향(-) 탐색
    for (let i = 1; i < 5; i++) {
        const nx = x - i * dx, ny = y - i * dy;
        if (nx < 0 || ny < 0 || nx >= 19 || ny >= 19 || board[ny][nx] === -player) {
            break;
        }
        if (board[ny][nx] === 0) {
            openEnds++;
            break;
        }
        count++;
    }

    // [핵심 수정] 양쪽이 막혀 더 이상 5목으로 발전할 수 없는 '죽은 라인'의 점수를 0으로 처리합니다.
    // 예를 들어, 상대방 돌에 의해 ●OOO● 와 같이 양쪽이 막힌 3, 4는 위협이 되지 않습니다.
    if (count < 5 && openEnds === 0) {
        return 0;
    }

    if (count >= 5) return 1000000;
    if (count === 4) return openEnds === 2 ? 100000 : 10000;
    // [수정] 한쪽이 막힌 3(닫힌 3)의 방어 점수 가치를 약간 낮춰, AI가 덜 중요한 방어보다 자신의 공격을 선호하게 만듭니다.
    if (count === 3) return openEnds === 2 ? 5000 : 400;
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
    // 3-3 금수는 흑에게만 적용됩니다.
    if (player !== 1) {
        return false;
    }

    // 해당 위치에 돌을 놓았다고 가정합니다.
    board[y][x] = player;

    // 이 수로 인해 5목 이상이 만들어지면 금수가 아닙니다 (게임 승리).
    if (checkWin(board, player)) {
        board[y][x] = 0; // 보드 원상복구
        return false;
    }
    
    let openThreeCount = 0;
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]]; // 가로, 세로, 대각선2

    // 4방향에 대해 열린 3(Live Three)이 몇 개 만들어지는지 확인합니다.
    for (const [dx, dy] of directions) {
        if (checkOpenThree(x, y, dx, dy)) {
            openThreeCount++;
        }
    }

    // 보드를 원래 상태로 되돌립니다.
    board[y][x] = 0;

    // 열린 3이 2개 이상 만들어지면 3-3 금수입니다.
    return openThreeCount >= 2;
}


/**
 * 특정 위치에 돌을 놓았을 때, 특정 방향으로 '열린 3'이 만들어지는지 확인하는 헬퍼 함수
 * @param {number} x - 현재 돌의 x 좌표
 * @param {number} y - 현재 돌의 y 좌표
 * @param {number} dx - 확인할 방향의 x 증분
 * @param {number} dy - 확인할 방향의 y 증분
 * @returns {boolean} '열린 3'이 맞으면 true
 */
function checkOpenThree(x, y, dx, dy) {
    const player = board[y][x];

    // 한 방향으로 연속된 아군 돌의 개수 세기
    let count = 1;
    let openEnds = 0;

    // 정방향(+) 탐색
    let i = 1;
    while (true) {
        const nx = x + i * dx;
        const ny = y + i * dy;
        if (nx < 0 || nx >= 19 || ny < 0 || ny >= 19 || board[ny][nx] !== player) {
            // 빈 칸이면 열린 것으로 간주
            if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === 0) {
                openEnds++;
            }
            break;
        }
        count++;
        i++;
    }

    // 역방향(-) 탐색
    i = 1;
    while (true) {
        const nx = x - i * dx;
        const ny = y - i * dy;
        if (nx < 0 || nx >= 19 || ny < 0 || ny >= 19 || board[ny][nx] !== player) {
            // 빈 칸이면 열린 것으로 간주
            if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === 0) {
                openEnds++;
            }
            break;
        }
        count++;
        i++;
    }
    
    // 정확히 3개의 돌이 있고, 양쪽이 모두 막혀있지 않아야 '열린 3' 입니다.
    return count === 3 && openEnds === 2;
}

function playSound(soundFile) { const audio = new Audio(`sounds/${soundFile}`); audio.play(); }
function checkDraw() { return moveCount >= 361; }