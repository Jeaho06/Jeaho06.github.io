// --- 전역 변수 ---

// Firebase SDK import
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase 설정 객체
// [중요] 아래 값들을 실제 본인의 Firebase 프로젝트 값으로 채워주세요.
const firebaseConfig = {
  apiKey: "API_KEY",
  authDomain: "AUTH_DOMAIN",
  projectId: "PROJECT_ID",
  storageBucket: "STORAGE_BUCKET",
  messagingSenderId: "MESSAGING_SENDER_ID",
  appId: "APP_ID",
  measurementId: "MEASUREMENT_ID"
};ㄴ
// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 사용자 정보 및 상태 관련 전역 변수
let currentUser = null;
let userData = null;
let guestData = { stats: { wins: 0, losses: 0 }, achievements: [] };

const board = Array(19).fill().map(() => Array(19).fill(0));
const gridSize = 30;
let isAITurn = false;
let lastMove = null;
let isFirstMove = true;
let moveCount = 0;
let isDestinyDenialUsed = false;
let bombState = { isArmed: false, col: null, row: null };
let currentLanguage = 'ko';
let currentStrings = {};
let gameOver = false;
let cheatProbability = 0.4;

// --- 페이지 로드 및 초기화 ---
document.addEventListener('DOMContentLoaded', async function() {
  const savedLang = localStorage.getItem('omokLanguage') || 'ko';
  await changeLanguage(savedLang);
  initializeGame();
});

function initializeGame() {
    createBoardUI();
    resetGame();
    setupEventListeners();
    setupAuthEventListeners();
}

function resetGame() {
    for (let i = 0; i < 19; i++) {
        board[i].fill(0);
    }
    isAITurn = false;
    lastMove = null;
    isFirstMove = true;
    moveCount = 0;
    isDestinyDenialUsed = false;
    bombState = { isArmed: false, col: null, row: null };
    gameOver = false;
    document.getElementById('move-log').innerHTML = '';
    document.getElementById('reasoning-log').innerHTML = '';

    const boardElement = document.getElementById('game-board');
    const dynamicElements = boardElement.querySelectorAll('.stone, .denied-spot, .bomb-effect, #game-over-message');
    dynamicElements.forEach(el => el.remove());

    const gameOverDiv = document.createElement('div');
    gameOverDiv.id = 'game-over-message';
    gameOverDiv.className = 'hidden';
    boardElement.appendChild(gameOverDiv);
}

// --- 인증 및 UI 관리 함수 ---
async function signUp(nickname, password) {
    const nicknameRegex = /^[a-zA-Z0-9]{2,10}$/;
    if (!nicknameRegex.test(nickname)) {
        alert(getString('nickname_rule_alert'));
        return;
    }
    const fakeEmail = `${nickname.trim().toLowerCase()}@omok.game`;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, password);
        const user = userCredential.user;
        const initialData = JSON.parse(localStorage.getItem('omok_guestData')) || {
            nickname: nickname.trim(),
            stats: { wins: 0, losses: 0 },
            achievements: []
        };
        initialData.nickname = nickname.trim();
        await setDoc(doc(db, "users", user.uid), initialData);
        localStorage.removeItem('omok_guestData');
        alert(getString('signup_success_alert'));
        document.getElementById('auth-modal').style.display = 'none';
        document.getElementById('popup-overlay').style.display = 'none';
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            alert(getString('nickname_in_use_alert'));
        } else {
            alert(getString('signup_fail_alert', { error: error.message }));
        }
    }
}

async function logIn(nickname, password) {
    const fakeEmail = `${nickname.trim().toLowerCase()}@omok.game`;
    try {
        await signInWithEmailAndPassword(auth, fakeEmail, password);
        alert(getString('login_success_alert'));
        document.getElementById('auth-modal').style.display = 'none';
        document.getElementById('popup-overlay').style.display = 'none';
    } catch (error) {
        if (error.code === 'auth/invalid-credential') {
             alert(getString('invalid_credentials_alert'));
        } else {
            alert(getString('login_fail_alert', { error: error.message }));
        }
    }
}

function logOut() {
    signOut(auth);
    alert(getString('logout_success_alert'));
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            userData = docSnap.data();
            updateUIForLogin();
        } else {
            logOut();
        }
    } else {
        currentUser = null;
        userData = null;
        const savedGuestData = localStorage.getItem('omok_guestData');
        guestData = savedGuestData ? JSON.parse(savedGuestData) : { stats: { wins: 0, losses: 0 }, achievements: [] };
        updateUIForLogout();
    }
});

function updateUIForLogin() {
    document.getElementById('guest-display').style.display = 'none';
    document.getElementById('user-display').style.display = 'flex';
    document.getElementById('nickname-display').textContent = getString('welcome_message', { nickname: userData.nickname });
}

function updateUIForLogout() {
    document.getElementById('user-display').style.display = 'none';
    document.getElementById('guest-display').style.display = 'flex';
}

function saveGuestData() {
    localStorage.setItem('omok_guestData', JSON.stringify(guestData));
}

function setupAuthEventListeners() {
    const authModal = document.getElementById('auth-modal');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    document.getElementById('open-login-modal-btn').addEventListener('click', () => {
        authModal.style.display = 'block';
        document.getElementById('popup-overlay').style.display = 'block';
    });
    authModal.querySelector('.popup-close-button').addEventListener('click', () => {
        authModal.style.display = 'none';
        document.getElementById('popup-overlay').style.display = 'none';
    });

    document.getElementById('show-signup').addEventListener('click', (e) => { e.preventDefault(); loginForm.style.display = 'none'; signupForm.style.display = 'block'; });
    document.getElementById('show-login').addEventListener('click', (e) => { e.preventDefault(); signupForm.style.display = 'none'; loginForm.style.display = 'block'; });

    document.getElementById('signup-btn').addEventListener('click', () => signUp(document.getElementById('signup-nickname').value, document.getElementById('signup-password').value));
    document.getElementById('login-btn').addEventListener('click', () => logIn(document.getElementById('login-nickname').value, document.getElementById('login-password').value));
    document.getElementById('logout-button').addEventListener('click', logOut);
}

function setupEventListeners() {
    setupBoardClickListener();
    setupNewGameButton();
    setupUpdatePopup();
    setupLanguageSwitcher();
    setupPopupOverlay();
    setupFeedbackWidget();
    setupProfilePopup();
}

function setupFeedbackWidget() {
    const widget = document.getElementById('feedback-widget');
    const toggleBtn = document.getElementById('feedback-toggle-btn');
    if (widget && toggleBtn) {
        toggleBtn.addEventListener('click', () => widget.classList.toggle('open'));
    }
}

// --- 언어 및 로깅 함수 ---
async function changeLanguage(lang) {
  try {
    const response = await fetch(`./lang/${lang}.json`);
    if (!response.ok) throw new Error(`Language file for ${lang} not found!`);
    currentStrings = await response.json();
    currentLanguage = lang;
    document.documentElement.lang = lang;
    localStorage.setItem('omokLanguage', lang);

    document.querySelectorAll('[data-i18n-key]').forEach(el => {
      const key = el.dataset.i18nKey;
      if (currentStrings[key]) { el.textContent = currentStrings[key]; }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      if (currentStrings[key]) { el.placeholder = currentStrings[key]; }
    });
    
    const aboutLink = document.querySelector('a[data-i18n-key="about_page"]');
    if (aboutLink) aboutLink.href = `pages/about_${lang}.html`;
    const privacyLink = document.querySelector('a[data-i18n-key="privacy_policy"]');
    if (privacyLink) privacyLink.href = `pages/privacy_${lang}.html`;
  } catch (error) {
    console.error("Could not load language file:", error);
    if (lang !== 'ko') await changeLanguage('ko');
  }
}

function getString(key, replacements = {}) {
    let str = currentStrings[key] || `[${key}]`;
    for (const placeholder in replacements) {
        str = str.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return str;
}

function logMove(count, message) {
  const moveLog = document.getElementById("move-log");
  const p = document.createElement("p");
  p.innerHTML = `${count}. ${message}`;
  moveLog.appendChild(p);
  moveLog.scrollTop = moveLog.scrollHeight;
}

function logReason(sender, message) {
  const reasonLog = document.getElementById("reasoning-log");
  const p = document.createElement("p");
  p.textContent = `${sender}: ${message}`;
  reasonLog.appendChild(p);
  reasonLog.scrollTop = reasonLog.scrollHeight;
}

// --- UI 생성 및 이벤트 핸들러 ---
function createBoardUI() {
  const boardElement = document.getElementById("game-board");
  boardElement.innerHTML = '';
  for (let i = 0; i < 19; i++) {
    const lineH = document.createElement("div"); lineH.className = "line horizontal-line"; lineH.style.top = `${i * gridSize + gridSize / 2}px`; boardElement.appendChild(lineH);
    const lineV = document.createElement("div"); lineV.className = "line vertical-line"; lineV.style.left = `${i * gridSize + gridSize / 2}px`; boardElement.appendChild(lineV);
  }
  for (let i = 0; i < 19; i++) {
    const colLabel = document.createElement("div"); colLabel.className = "coordinate-label top-label"; colLabel.style.left = `${i * gridSize + gridSize / 2}px`; colLabel.textContent = String.fromCharCode(65 + i); boardElement.appendChild(colLabel);
    const rowLabel = document.createElement("div"); rowLabel.className = "coordinate-label left-label"; rowLabel.style.top = `${i * gridSize + gridSize / 2}px`; rowLabel.textContent = i + 1; boardElement.appendChild(rowLabel);
  }
}

function setupBoardClickListener() {
  const boardElement = document.getElementById("game-board");
  boardElement.addEventListener('click', (event) => {
    if (isAITurn || gameOver) return;
    const rect = boardElement.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const closestX = Math.round((offsetX - gridSize / 2) / gridSize);
    const closestY = Math.round((offsetY - gridSize / 2) / gridSize);
    if (closestX < 0 || closestX >= 19 || closestY < 0 || closestY >= 19) return;
    if (board[closestY][closestX] === 3) {
      logReason(getString('user_title'), getString('system_denied_spot')); return;
    }
    if (board[closestY][closestX] === 0) {
        board[closestY][closestX] = 1;
        const isWinningMove = checkWin(board, 1);
        board[closestY][closestX] = 0;
        if (isWinningMove && !isDestinyDenialUsed && document.getElementById('toggle-destiny-denial').checked) {
            isDestinyDenialUsed = true; board[closestY][closestX] = 3; 
            const deniedSpot = document.createElement("div"); deniedSpot.className = "denied-spot";
            deniedSpot.style.left = `${closestX * gridSize + gridSize / 2}px`; deniedSpot.style.top = `${closestY * gridSize + gridSize / 2}px`;
            deniedSpot.setAttribute("data-col", closestX); deniedSpot.setAttribute("data-row", closestY);
            boardElement.appendChild(deniedSpot);
            const deniedCoord = convertCoord(closestX, closestY);
            logMove(++moveCount, `${getString('ai_title')}: ${getString('cheat_veto')}!!`);
            logReason(getString('ai_title'), getString('ai_veto_reason', {coord: deniedCoord}));
            return; 
        }
    }
    if (board[closestY][closestX] !== 0) return;
    if (isForbiddenMove(closestX, closestY, 1)) { logReason(getString('user_title'), getString('system_forbidden')); return; }
    board[closestY][closestX] = 1; placeStone(closestX, closestY, 'black'); playSound("Movement.mp3");
    const userCoord = convertCoord(closestX, closestY);
    logMove(++moveCount, `${getString('user_title')}: ${userCoord}??`);
    isFirstMove = false; lastMove = { col: closestX, row: closestY };
    if (checkWin(board, 1)) { endGame(getString('system_user_win')); return; }
    isAITurn = true;
    setTimeout(aiMove, 1000);
  });
}

function setupNewGameButton() {
    const newGameButton = document.getElementById('new-game-button');
    if(newGameButton) newGameButton.addEventListener('click', resetGame);
}

function setupUpdatePopup() {
    const updateButton = document.getElementById('update-button');
    const updatePopup = document.getElementById('update-popup');
    const prevBtn = document.getElementById('prev-version-btn');
    const nextBtn = document.getElementById('next-version-btn');
    const versionContainer = document.getElementById('version-details-container');
    let currentVersionIndex = 0;

    const renderUpdateLogs = () => {
        const logs = currentStrings.update_logs || [];
        versionContainer.innerHTML = '';
        logs.forEach(log => {
            const logDiv = document.createElement('div'); logDiv.className = 'version-log';
            const notesHtml = log.notes.map(note => `<li>${note}</li>`).join('');
            logDiv.innerHTML = `<p><strong>Version ${log.version}</strong> (${log.date})</p><ul>${notesHtml}</ul>`;
            versionContainer.appendChild(logDiv);
        });
        showVersion(0);
    };

    const showVersion = (index) => {
        const versionLogs = versionContainer.querySelectorAll('.version-log');
        if (!versionLogs.length) return;
        currentVersionIndex = index;
        versionLogs.forEach((log, i) => { log.classList.toggle('active-version', i === index); });
        prevBtn.classList.toggle('disabled', index === versionLogs.length - 1);
        nextBtn.classList.toggle('disabled', index === 0);
    };

    if (updateButton && updatePopup && prevBtn && nextBtn) {
        updateButton.addEventListener('click', () => { renderUpdateLogs(); updatePopup.style.display = 'block'; document.getElementById('popup-overlay').style.display = 'block'; });
        prevBtn.addEventListener('click', () => { if (currentVersionIndex < versionContainer.querySelectorAll('.version-log').length - 1) showVersion(currentVersionIndex + 1); });
        nextBtn.addEventListener('click', () => { if (currentVersionIndex > 0) showVersion(currentVersionIndex - 1); });
    }
}

function setupPopupOverlay() {
    const overlay = document.getElementById('popup-overlay');
    const popups = document.querySelectorAll('.popup');
    const closeButtons = document.querySelectorAll('.popup-close-button');
    const closeAllPopups = () => {
        popups.forEach(p => p.style.display = 'none');
        overlay.style.display = 'none';
    };
    overlay.addEventListener('click', closeAllPopups);
    closeButtons.forEach(btn => btn.addEventListener('click', closeAllPopups));
}

async function endGame(message) {
    gameOver = true;
    const gameOverMessage = document.getElementById('game-over-message');
    gameOverMessage.textContent = message;
    gameOverMessage.classList.remove('hidden');
    gameOverMessage.classList.add('visible');
    logReason("시스템", message);

    const isUserWin = message === getString('system_user_win');

    if (currentUser && userData) {
        if (isUserWin) userData.stats.wins++;
        else userData.stats.losses++;
        await updateDoc(doc(db, "users", currentUser.uid), { stats: userData.stats });
    } else {
        if (isUserWin) guestData.stats.wins++;
        else guestData.stats.losses++;
        saveGuestData();
        alert(getString('guest_save_notice'));
    }
}

// --- AI 로직 ---
function aiMove() {
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
      moveAction = chosenCheat;
    } else { moveAction = () => performNormalMove(); }
  } else { moveAction = () => performNormalMove(); }
  
  const actionResult = moveAction();
  if (actionResult && actionResult.isAsync === false) {
    if (checkWin(board, -1)) endGame(getString('system_ai_win')); 
    else isAITurn = false;
  } else if (!actionResult) {
    const normalMoveResult = performNormalMove();
    if(normalMoveResult && normalMoveResult.isAsync === false){
      if (checkWin(board, -1)) endGame(getString('system_ai_win'));
      else isAITurn = false;
    }
  }
}

function findBestMove() {
  let bestMove = null; let bestScore = -1;
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
        return { isAsync: false };
    }
    logReason(getString('ai_title'), getString('system_no_move'));
    isAITurn = false;
    return { isAsync: true };
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
        isAITurn = false; return { isAsync: true };
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
    return { isAsync: true };
}

function performDoubleMove() {
    const firstMoveResult = performNormalMove();
    if (firstMoveResult && firstMoveResult.isAsync === false) {
        if (gameOver) return {isAsync: true};
        const move2 = findBestMove();
        if (move2 && board[move2.row][move2.col] === 0) {
            setTimeout(() => {
                board[move2.row][move2.col] = -1; 
                placeStone(move2.col, move2.row, 'white'); 
                playSound("Movement.mp3");
                const aiCoord2 = convertCoord(move2.col, move2.row);
                logMove(++moveCount, `${getString('ai_title')}: ${aiCoord2}!!`);
                logReason(getString('ai_title'), getString('ai_double_move_2', { coord: aiCoord2 }));
                if (checkWin(board, -1)) { endGame(getString('system_ai_win')); } else { isAITurn = false; }
            }, 800);
        } else { isAITurn = false; }
        return { isAsync: true };
    }
    return false;
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
        return { isAsync: true };
    }
    return false;
}

function placeStone(col, row, color) {
    const boardElement = document.getElementById("game-board");
    const lastStoneEl = document.querySelector('.last-move'); if (lastStoneEl) lastStoneEl.classList.remove('last-move');
    const stone = document.createElement("div");
    stone.className = `stone ${color}`;
    stone.style.left = `${col * gridSize + gridSize / 2}px`; stone.style.top = `${row * gridSize + gridSize / 2}px`;
    stone.setAttribute("data-col", col); stone.setAttribute("data-row", row);
    boardElement.appendChild(stone);
    if (color !== 'bomb') { stone.classList.add("last-move"); }
}

function removeStone(col, row) {
    const stoneElement = document.querySelector(`.stone[data-col='${col}'][data-row='${row}']`);
    if (stoneElement) stoneElement.remove();
    const deniedSpotElement = document.querySelector(`.denied-spot[data-col='${col}'][data-row='${row}']`);
    if (deniedSpotElement) deniedSpotElement.remove();
    if (row >= 0 && row < 19 && col >= 0 && col < 19) board[row][col] = 0;
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

function setupProfilePopup() {
    const profileButton = document.getElementById('profile-button');
    const profilePopup = document.getElementById('profile-popup');
    const overlay = document.getElementById('popup-overlay');

    if (!profileButton || !profilePopup) return;

    profileButton.addEventListener('click', () => {
        const data = currentUser ? userData : guestData;
        updateProfilePopupContent(data);
        profilePopup.style.display = 'block';
        overlay.style.display = 'block';
    });
}

function updateProfilePopupContent(data) {
    const winsEl = document.getElementById('profile-wins');
    const lossesEl = document.getElementById('profile-losses');
    const winRateEl = document.getElementById('profile-win-rate');
    const titleEl = document.getElementById('profile-popup-title');

    if (!data || !data.stats) { console.error("프로필 데이터를 불러올 수 없습니다."); return; }

    const wins = data.stats.wins || 0, losses = data.stats.losses || 0;
    const totalGames = wins + losses;
    const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

    winsEl.textContent = wins;
    lossesEl.textContent = losses;
    winRateEl.textContent = `${winRate}%`;

    if (data.nickname) titleEl.textContent = getString('profile_title_user', { nickname: data.nickname });
    else titleEl.textContent = getString('profile_title_guest');
    
    // 업적 시스템은 추후 구현
}


function setupLanguageSwitcher() {
    const langButton = document.getElementById('language-button');
    const langDropdown = document.getElementById('language-dropdown');
    langButton.addEventListener('click', (event) => {
        event.stopPropagation();
        langDropdown.classList.toggle('show-dropdown');
    });
    document.addEventListener('click', (event) => {
        if (!langButton.contains(event.target)) {
            langDropdown.classList.remove('show-dropdown');
        }
    });
    langDropdown.addEventListener('click', async (event) => {
        event.preventDefault();
        if (event.target.tagName === 'A') {
            const lang = event.target.dataset.lang;
            await changeLanguage(lang);
            langDropdown.classList.remove('show-dropdown');
        }
    });
}
