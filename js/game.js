// game.js 파일의 endGame 함수를 찾아 아래 코드로 교체하세요.

// --- 필요한 함수들을 다른 모듈에서 import ---
// [수정] updateUserStats 대신 updateUserGameResult를 import 합니다.
import { createBoardUI, placeStone, removeStone, logMove, logReason, showEndGameMessage, getString, showLevelUpAnimation } from './ui.js';
import { db, updateUserGameResult } from './firebase.js';
import { openingBook } from './openings.js';

// --- 원본 script.js의 전역 변수들을 모듈의 최상위 스코프로 이동 ---
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

// --- 이하 원본 script.js의 모든 게임 관련 함수 (버그 수정 포함) ---

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
    updateAIWinRateUI(0); // 승률 표시를 50%로 초기화
}

/**
 * AI의 판세 분석 점수를 기반으로 예상 승률 UI를 업데이트합니다.
 * @param {number} score - AI가 판단한 현재 판의 점수
 */
function updateAIWinRateUI(score) {
    if (gameOver) return;

    // 점수를 0-100% 범위의 확률로 변환 (Sigmoid 함수 활용)
    // 점수 0점 = 50%, 점수가 높을수록 100%에, 낮을수록 0%에 가까워집니다.
    const winProbability = 1 / (1 + Math.exp(-score / 5000));
    const winRate = Math.round(winProbability * 100);

    const displayElement = document.getElementById('ai-win-rate-display');
    if (displayElement) displayElement.textContent = `${winRate}%`;
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
    moveHistory.push({ col, row });
    placeStone(col, row, 'black'); 
    playSound("Movement.mp3");
    logMove(++moveCount, `${getString('user_title')}: ${convertCoord(col, row)}??`);
    isFirstMove = false; 
    lastMove = { col, row };
    
    if (checkWin(board, 1)) { endGame(getString('system_user_win')); return; }
    if (checkDraw()) { endGame(getString('system_draw')); return; }
    
    // 사용자가 수를 둔 후, AI가 생각하는 판세 점수를 계산하여 승률 UI 업데이트
    const { score: currentScore } = findBestMove();
    updateAIWinRateUI(currentScore);

    isAITurn = true;
    setTimeout(aiMove, 500);
  });
}

// js/game.js

// ... (다른 부분은 그대로 유지) ...

// game.js

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
            
            // ▼▼▼ 핵심 수정 부분 ▼▼▼

            // 1. 게임 종료 메시지를 먼저 표시합니다.
            showEndGameMessage(eventData);
            logReason("시스템", message);
            
            // 2. 만약 레벨업을 했다면, 그 위로 레벨업 연출을 덮어씌웁니다.
            if (result.didLevelUp) {
                console.log("레벨 업! 새로운 레벨:", result.newLevel);
                // z-index가 높기 때문에, 이 연출이 게임 종료 메시지보다 위에 나타납니다.
                showLevelUpAnimation(result.newLevel - 1, result.newLevel);
            }

            // ▲▲▲ 여기까지 입니다 ▲▲▲
        } else {
            // result가 없는 경우 (DB 업데이트 실패 등)에도 기본 메시지는 표시
            showEndGameMessage(eventData);
            logReason("시스템", message);
        }
    } else {
        // 게스트일 경우
        const guestData = JSON.parse(localStorage.getItem('omok_guestData')) || { stats: { wins: 0, losses: 0, draws: 0 } };
        if (gameResult === 'win') guestData.stats.wins++;
        else if (gameResult === 'draw') guestData.stats.draws++;
        else guestData.stats.losses++;
        localStorage.setItem('omok_guestData', JSON.stringify(guestData));
        
        // 게스트일 때도 게임 종료 메시지를 표시합니다.
        showEndGameMessage(eventData);
        logReason("시스템", message);
    }

    /* 기존에 이 위치에 있던 showEndGameMessage와 logReason 호출은 
    if (currentUser) 블록 안으로 이동했으므로 여기서는 삭제합니다.
    */
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
// js/game.js 파일의 performNormalMove 함수를 아래 코드로 교체하세요.

function performNormalMove() {
    const { move, score } = findBestMove();
    if (move && board[move.row][move.col] === 0) {
        // [수정] 점수 계산 및 이유 생성 로직 전체 복구
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

        // --- 이하 로직은 동일 ---
        board[move.row][move.col] = -1;
        moveHistory.push({ col: move.col, row: move.row });
        placeStone(move.col, move.row, 'white');
        playSound("Movement.mp3");
        logMove(++moveCount, `${getString('ai_title')}: ${aiCoord}`);
        
        // [수정] 구체적인 이유를 로그에 기록하도록 복구
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
        // AI가 수를 둔 후, 변경된 판세를 다시 평가하여 승률을 업데이트합니다.
        if (!gameOver) {
            // AI가 수를 둔 후의 판세에 대한 최고 점수를 다시 계산합니다.
            const { score: newBoardScore } = findBestMove();
            updateAIWinRateUI(newBoardScore);
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
        if (checkWin(board, 1)) { 
            endGame(getString('system_user_win')); 
        } else if (checkWin(board, -1)) { 
            endGame(getString('system_ai_win')); 
        } else {
            isAITurn = false;
            // 폭발 후 게임이 끝나지 않았다면, 변경된 판세를 기반으로 승률을 업데이트합니다.
            if (!gameOver) {
                const { score } = findBestMove();
                updateAIWinRateUI(score);
            }
        }
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
        const { score } = findBestMove();
        updateAIWinRateUI(score);
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
            const { score } = findBestMove();
            updateAIWinRateUI(score);
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

/**
 * 오프닝 북에서 현재 수순에 맞는 다음 수를 찾습니다.
 * @returns {object|null} 찾은 경우 좌표 객체, 못 찾은 경우 null
 */
function findMoveInOpeningBook() {
    if (moveHistory.length === 0) return null;

    // 현재까지의 수순으로 키를 생성합니다. (e.g., "9,9_9,10")
    const key = moveHistory.map(m => `${m.col},${m.row}`).join('_');
    const possibleMoves = openingBook[key];

    if (possibleMoves && possibleMoves.length > 0) {
        // 오프닝 북에 정의된 수들 중, 현재 비어있는 칸을 찾습니다.
        const validMoves = possibleMoves.filter(move => board[move.row][move.col] === 0);
        if (validMoves.length > 0) {
            // 여러 개의 유효한 수가 있다면 그중 하나를 무작위로 선택합니다.
            return validMoves[Math.floor(Math.random() * validMoves.length)];
        }
    }
    // 일치하는 수순이 없는 경우
    return null;
}

function findBestMove() {
    let bestMove = null;
    let bestScore = -Infinity;
    const relevantMoves = getRelevantMoves();

    if (relevantMoves.length === 0) {
        // 둘 곳이 없는 비상 상황 (이론상 발생하지 않음)
        return { move: { col: 9, row: 9 }, score: 0 };
    }

    // [핵심] 오프닝 북 로직: 게임 초반(7수 미만)에만 작동합니다.
    if (moveCount < 7) {
        const openingMove = findMoveInOpeningBook();
        if (openingMove) {
            // 오프닝 북에서 찾은 수를 높은 점수와 함께 반환하여 즉시 선택하도록 합니다.
            // 사유 로깅은 performNormalMove에서 일괄 처리하여 더 그럴듯하게 보입니다.
            return { move: openingMove, score: 50000 };
        }
    }

    // 오프닝 북에서 수를 찾지 못하면 기존의 계산 로직을 수행합니다.
    for (const move of relevantMoves) {
        if (board[move.row][move.col] === 0) {
            // [수정] AI의 공격적인 성향을 강화하기 위해 공격 점수에 가중치를 부여합니다.
            const aggressionFactor = 1.2;
            const myScore = calculateScore(move.col, move.row, -1).totalScore * aggressionFactor;
            const opponentScore = calculateScore(move.col, move.row, 1).totalScore;
            const totalScore = myScore + opponentScore;

            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestMove = move;
            }
        }
    }
    // 만약 유효한 수를 찾지 못했다면(예: 모든 관련 위치가 이미 채워짐), 첫 번째 관련 수나 중앙을 반환합니다.
    return { move: bestMove || relevantMoves[0], score: bestScore };
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

// js/game.js 파일의 isForbiddenMove 함수를 아래 코드로 교체하세요.

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

function convertCoord(col, row) { return String.fromCharCode(65 + col) + (row + 1); }
function playSound(soundFile) { const audio = new Audio(`sounds/${soundFile}`); audio.play(); }
function checkDraw() { return moveCount >= 361; }