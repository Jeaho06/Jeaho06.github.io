// --- 필요한 함수들을 다른 모듈에서 import ---
import { updatePlayerInfoBox, updateLevelUI, getInitializedString, createBoardUI, placeStone, removeStone, logMove, logReason, showEndGameMessage, getString, showLevelUpAnimation, convertCoord } from './ui.js';
import { db, updateUserGameResult } from './firebase.js';
import { findBestMoveAI } from './ai.js';
import { resetWinRate, updateWinRate } from './winRateManager.js';
import { executeDestinyDenial } from './cheats/destinyDenial.js';
import { executePlaceBomb } from './cheats/placeBomb.js';
import { executeDoubleMove } from './cheats/doubleMove.js';
import { executeStoneSwap } from './cheats/stoneSwap.js';
import { updateGuestGameResult, loadGuestData } from './guestManager.js';
import { playSfx } from './audioManager.js'; // 새로 추가
import { getCurrentUser, getUserData, getGuestData } from './common.js';
import { checkAndPlayEffects, playEffectForTesting } from './effectController.js';

const urlParams = new URLSearchParams(window.location.search);
const isDevMode = urlParams.get('dev') === 'true';
const gameType = urlParams.get('type') || 'basic'; // 'normal', 'ranked', 없으면 'basic'

window.testEffect = playEffectForTesting;
console.log("개발자용 테스트 함수 'testEffect(eventName, data)'가 준비되었습니다.");

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
let activeCheats = {}; // <<< 현재 게임에 활성화된 반칙을 저장할 변수 추가

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

export function updateActiveCheatsLanguage() {
    const activeCheatsList = document.getElementById('active-cheats-list');
    if (!activeCheatsList) return;

    // 목록 안에 있는 각 반칙 태그(span)를 찾습니다.
    activeCheatsList.querySelectorAll('.cheat-tag').forEach(tag => {
        const i18nKey = tag.dataset.i18nKey; // span에 저장된 언어 키를 가져옵니다.
        if (i18nKey) {
            tag.textContent = getString(i18nKey); // 키를 사용해 다시 번역합니다.
        }
    });
}

export async function resetGame(settings = {}) {
    console.log(`Game Start! Type: ${gameType}`);
    
    updatePlayerTitle(userData, guestData);
        // ▼▼▼ 이 코드를 추가하면 안정성이 높아집니다 ▼▼▼
    const moveLog = document.getElementById('move-log');
    if (!moveLog) {
      // 게임 보드 요소가 없으면 함수를 실행하지 않고 종료
      return; 
    }
        // 전달받은 설정에 따라 activeCheats 객체를 설정
    activeCheats = {
        veto: settings.cheats?.includes('veto') || false,
        bomb: settings.cheats?.includes('bomb') || false,
        doubleMove: settings.cheats?.includes('doubleMove') || false,
        swap: settings.cheats?.includes('swap') || false,
    };
    // ▲▲▲ 여기까지 추가 ▲▲▲

        // ▼▼▼ 이 코드를 추가합니다 ▼▼▼
    const activeCheatsList = document.getElementById('active-cheats-list');
    if (activeCheatsList) {
        activeCheatsList.innerHTML = ''; // 목록 초기화
        // ▼▼▼ 이 부분을 수정합니다 ▼▼▼
        // 각 반칙 키(doubleMove)를 실제 언어 파일 키(cheat_double_move)와 직접 매핑합니다.
        const cheatNameMap = {
            veto: 'cheat_veto',
            bomb: 'cheat_bomb',
            doubleMove: 'cheat_double_move', // JavaScript 변수 'doubleMove'를 'cheat_double_move' 키에 연결
            swap: 'cheat_swap'
        };
        
        const enabledCheats = Object.keys(activeCheats).filter(key => activeCheats[key]);
        
        if (enabledCheats.length > 0) {
        // forEach는 await를 기다려주지 않으므로, for...of 루프로 변경합니다.
        for (const cheatKey of enabledCheats) {
            const cheatTag = document.createElement('span');
            cheatTag.className = 'cheat-tag';
            
            const i18nKey = cheatNameMap[cheatKey];
            // ▼▼▼ 이 부분을 수정합니다 ▼▼▼
            // 나중에 다시 번역할 수 있도록, span에 언어 키(꼬리표)를 저장해 둡니다.
            cheatTag.dataset.i18nKey = i18nKey; 
            cheatTag.textContent = await getInitializedString(i18nKey); 
            // ▲▲▲ 여기까지 수정 ▲▲▲
            activeCheatsList.appendChild(cheatTag);
        }
        } else {
            // ▼▼▼ 이 부분을 수정합니다 ▼▼▼
            // '없음' 텍스트를 표시하고, 꼬리표를 추가합니다.
            activeCheatsList.dataset.i18nKey = 'no_cheats_enabled';
            activeCheatsList.textContent = await getInitializedString('no_cheats_enabled');
            // ▲▲▲ 여기까지 수정 ▲▲▲
        }
        // ▲▲▲ 여기까지 수정 ▲▲▲
    }
    // ▲▲▲ 여기까지 추가 ▲▲▲
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

        // ▼▼▼ 이 부분을 추가하세요 ▼▼▼
    const notification = document.getElementById('game-start-notification');
    if (notification) {
        notification.classList.remove('hidden'); // 일단 보이게
        notification.classList.add('show');
        playSfx('start');
        // 2.5초 후에 애니메이션이 끝나므로 DOM에서 완전히 숨김
        setTimeout(() => {
            notification.classList.remove('show');
            notification.classList.add('hidden');
        }, 2500);
    }
    // ▲▲▲ 여기까지 ▲▲▲
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
    const denialContext = { board, col, row, isWinningMove, isDestinyDenialUsed, moveCount, isVetoActive: activeCheats.veto};
    if (executeDestinyDenial(denialContext)) {
        isDestinyDenialUsed = true; // 스킬 사용 상태 업데이트
        moveCount++; // 수 카운트 업데이트
        return; // AI 턴으로 넘어가지 않고 사용자 턴 유지
    }
    
    if (isForbiddenMove(col, row, 1)) { logReason(getString('user_title'), getString('system_forbidden')); return; }
    board[row][col] = 1; 
    moveHistory.push({ col, row });
    placeStone(col, row, 'black'); 
    playSfx('move'); // playSound("Movement.mp3")를 이 코드로 변경합니다.
    logMove(++moveCount, `${getString('user_title')}: ${convertCoord(col, row)}??`);
    isFirstMove = false; 
    lastMove = { col, row };
    checkAndPlayEffects({ board, row, col, player: 1 });
    
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

// js/game.js

async function endGame(message) {
    if (gameOver) return;
    gameOver = true;
    
    let eventData = { message };

    const isUserWin = message === getString('system_user_win');
    const isDraw = message === getString('system_draw');
    const gameResult = isUserWin ? 'win' : (isDraw ? 'draw' : 'loss');

    // 현재 활성화된 반칙 목록을 배열로 만듭니다. (예: ['bomb', 'swap'])
    const currentCheats = Object.keys(activeCheats).filter(key => activeCheats[key]);

    if (currentUser) {
        const oldUserData = { ...userData }; 
        const result = await updateUserGameResult(currentUser.uid, gameResult, moveCount, activeCheats);
        
        if (result) {
            eventData.xpResult = result;
            eventData.oldUserData = oldUserData;

            // 로그인 유저 경험치 바 즉시 업데이트
            const newExperience = (oldUserData.experience || 0) + result.xpGained;
            const updatedDataForUI = { ...oldUserData, experience: newExperience, level: result.newLevel };
            updateLevelUI(updatedDataForUI);

            // [수정] '새 게임' 시 마지막 반칙 설정을 유지하도록 콜백을 수정합니다.
            showEndGameMessage(eventData, () => resetGame({ cheats: currentCheats }));
            logReason("시스템", message);
            
            if (result.didLevelUp) {
                showLevelUpAnimation(result.newLevel - 1, result.newLevel);
            }
        } else {
            showEndGameMessage(eventData, () => resetGame({ cheats: currentCheats }));
            logReason("시스템", message);
        }
    } else {
        // 게스트일 경우
        const oldGuestData = loadGuestData();
        const result = updateGuestGameResult(gameResult, moveCount, activeCheats);
        
        const newGuestData = loadGuestData();
        updateLevelUI(newGuestData);

        eventData.xpResult = result;
        eventData.oldUserData = oldGuestData;

        // [수정] '새 게임' 시 마지막 반칙 설정을 유지하도록 콜백을 수정합니다.
        showEndGameMessage(eventData, () => resetGame({ cheats: currentCheats }));
        logReason("시스템", message);
        
        if (result.didLevelUp) {
            showLevelUpAnimation(result.newLevel - 1, result.newLevel);
        }
    }
}

// ... (파일의 나머지 부분은 그대로 유지) ...

/**
 * [수정됨] AI의 턴을 시작하는 메인 함수.
 * 반칙을 사용하지 않을 경우, AI의 수를 계산하고 착수합니다.
 * 개발자 모드에서는 생각(원)을 먼저 보여주고, 3초 뒤에 착수합니다.
 */
function aiMove() {
    if (gameOver) return;
    if (bombState.isArmed) {
        detonateBomb();
        return; 
    }

    const willCheat = Math.random() < cheatProbability && !isFirstMove && lastMove;
    if (willCheat) {
        const availableCheats = [];
        if (activeCheats.bomb) availableCheats.push(executePlaceBomb);
        if (activeCheats.doubleMove) availableCheats.push(executeDoubleMove);
        if (activeCheats.swap) availableCheats.push(executeStoneSwap);
        
        if (availableCheats.length > 0) {
            const chosenCheat = availableCheats[Math.floor(Math.random() * availableCheats.length)];
            const context = {
                board, bombState, lastMove, moveCount, isAITurn,
                performNormalMove: () => placeAIMove(findBestMove()), // 수정됨: 일반 착수 함수 연결
                playSfx, updateWinRate, findBestMove, endGame, checkWin, gameOver: () => gameOver,
                calculateScore, convertCoord, removeStone, placeStone,
                getString, logMove, logReason,
                passTurnToPlayer: () => { isAITurn = false; }
            };
            
            if (chosenCheat(context)) {
                moveCount = context.moveCount;
                isAITurn = context.isAITurn;
                return;
            }
        }
    }

    // --- 일반 착수 로직 시작 ---
    // 1. AI가 즉시 최적의 수를 계산합니다.
    const result = findBestMove();

    // 2. 개발자 모드인지 확인합니다.
    if (isDevMode) {
        // 2-1. 개발자 모드라면 계산 결과를 즉시 시각화합니다.
        visualizeAIPolicy(result.policy);
        
        // 2-2. 3초(3000ms)의 지연을 둔 후에 돌을 놓는 함수를 호출합니다.
        setTimeout(() => {
            placeAIMove(result);
        }, 3000);

    } else {
        // 2-3. 개발자 모드가 아니라면 지연 없이 즉시 돌을 놓습니다.
        placeAIMove(result);
    }
}

/**
 * [새로 추가됨] AI의 계산 결과를 받아 실제로 돌을 놓고 게임을 진행하는 함수.
 * (기존 performNormalMove의 역할을 대체합니다)
 */
function placeAIMove(result) {

        // ▼▼▼ 여기에 코드를 추가합니다 ▼▼▼
    if (isDevMode) {
        clearAIPolicyVisualization();
    }
    // ▲▲▲ 여기까지 추가 ▲▲▲
    const { move, score, policy } = result;

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
        playSfx('move');
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
    playSfx('explosion');
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

// js/game.js (파일의 아무 곳에나 추가)

/**
 * [수정됨] AI가 계산한 후보 수들을 색상과 상대 가치(%)로 시각화합니다.
 * @param {Array} policyData - AI가 반환한 후보 수와 점수 목록
 */
function visualizeAIPolicy(policyData) {
    const visualizationLayer = document.getElementById('ai-policy-visualization');
    if (!visualizationLayer) return;
    visualizationLayer.innerHTML = '';

    // 후보 수가 없거나 최고 점수가 0 이하이면 시각화를 중단합니다.
    if (policyData.length === 0 || policyData[0].score <= 0) return;

    // 전체 최고점(1순위)을 기준으로 퍼센테이지를 계산하기 위해 저장합니다.
    const bestScore = policyData[0].score;

    // 차선 그룹(2순위 이하)의 최대 점수를 찾습니다. 후보 수가 1개일 경우를 대비합니다.
    const secondMaxScore = policyData.length > 1 ? policyData[1].score : 0;

    // 상위 10개의 후보만 시각화합니다.
    policyData.slice(0, 10).forEach((item, index) => {
        const { move, score } = item;

        const circle = document.createElement('div');
        circle.className = 'policy-circle';

        let colors;

        if (index === 0) {
            // 최선의 수(1순위)는 항상 1.0 값(파란색)을 가집니다.
            colors = getColorForScore(1.0);
        } else {
            // 차선 그룹은 그룹 내 최고점(secondMaxScore)을 기준으로 다시 정규화하고,
            // 이 값을 0.0 ~ 0.7(빨강-초록) 범위에 매핑하여 색을 결정합니다.
            const secondaryNormalized = secondMaxScore > 0 ? (score / secondMaxScore) : 0;
            colors = getColorForScore(secondaryNormalized * 0.7);
        }

        // 퍼센테이지는 항상 전체 최고점(bestScore)을 기준으로 표시합니다.
        const percentage = Math.round((score / bestScore) * 100);
        circle.textContent = `${percentage}%`;

        const size = 30;
        circle.style.width = `${size}px`;
        circle.style.height = `${size}px`;
        circle.style.lineHeight = '1.1';
        circle.style.backgroundColor = colors.background;
        circle.style.borderColor = colors.border;
        circle.style.left = `${move.col * 30 + 15}px`;
        circle.style.top = `${move.row * 30 + 15}px`;

        visualizationLayer.appendChild(circle);
    });
}

/**
 * 시각화된 내용을 모두 지웁니다.
 */
function clearAIPolicyVisualization() {
    const visualizationLayer = document.getElementById('ai-policy-visualization');
    if (visualizationLayer) {
        visualizationLayer.innerHTML = '';
    }
}

/**
 * [수정됨] 0과 1 사이의 정규화된 점수를 받아 연속적인 색상 코드를 반환합니다.
 * @param {number} value - 0 (최악) ~ 1 (최선) 사이의 점수
 * @returns {{background: string, border: string}} - 원의 배경 및 테두리 색상
 */
function getColorForScore(value) {
    // 색상 그라데이션 정의: [지점, [R, G, B]]
    const gradient = [
        [0.0, [220, 53, 69]],  // 0%  = Red
        [0.4, [255, 193, 7]],  // 40% = Yellow
        [0.7, [40, 167, 69]],  // 70% = Green
        [1.0, [0, 123, 255]]   // 100% = Blue
    ];

    let color1, color2, t;
    for (let i = 0; i < gradient.length - 1; i++) {
        if (value >= gradient[i][0] && value <= gradient[i+1][0]) {
            color1 = gradient[i][1];
            color2 = gradient[i+1][1];
            t = (value - gradient[i][0]) / (gradient[i+1][0] - gradient[i][0]);
            break;
        }
    }

    const r = Math.round(color1[0] + t * (color2[0] - color1[0]));
    const g = Math.round(color1[1] + t * (color2[1] - color1[1]));
    const b = Math.round(color1[2] + t * (color2[2] - color1[2]));

    return { background: `rgba(${r}, ${g}, ${b}, 0.5)`, border: `rgba(${r}, ${g}, ${b}, 0.8)` };
}

function checkDraw() { return moveCount >= 361; }

/**
 * 게임 화면의 플레이어 제목을 유저 데이터에 맞게 업데이트합니다.
 * @param {object} uData - 로그인한 사용자의 데이터
 * @param {object} gData - 게스트의 데이터
 */
function updatePlayerTitle(uData, gData) {
    const playerTitleEl = document.getElementById('player-title');
    if (!playerTitleEl) return;

    if (uData && uData.nickname) { // 로그인 유저
        playerTitleEl.textContent = uData.nickname;
    } else { // 게스트
        playerTitleEl.textContent = 'Guest';
    }
}

