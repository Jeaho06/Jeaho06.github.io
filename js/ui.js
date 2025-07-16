// js/ui.js
import { getRequiredXpForLevel } from './firebase.js'; // [추가]
let currentStrings = {};

export function setStrings(strings) {
    currentStrings = strings;
}

export function getString(key, replacements = {}) {
    let str = currentStrings[key] || `[${key}]`;
    for (const placeholder in replacements) str = str.replace(`{${placeholder}}`, replacements[placeholder]);
    return str;
}

export function placeStone(col, row, color) {
    const boardElement = document.getElementById("game-board");
    const lastStoneEl = document.querySelector('.last-move');
    if (lastStoneEl) lastStoneEl.classList.remove('last-move');
    
    const stone = document.createElement("div");
    stone.className = `stone ${color}`;
    stone.style.left = `${col * 30 + 15}px`;
    stone.style.top = `${row * 30 + 15}px`;
    stone.setAttribute("data-col", col);
    stone.setAttribute("data-row", row);
    boardElement.appendChild(stone);

    if (color !== 'bomb') stone.classList.add("last-move");
}

export function removeStone(col, row) {
    const stoneElement = document.querySelector(`.stone[data-col='${col}'][data-row='${row}']`);
    if (stoneElement) stoneElement.remove();
}

export function logMove(count, message) {
    const moveLog = document.getElementById("move-log");
    const p = document.createElement("p");
    p.innerHTML = `${count}. ${message}`;
    moveLog.appendChild(p);
    moveLog.scrollTop = moveLog.scrollHeight;
}

export function logReason(sender, message) {
    const reasonLog = document.getElementById("reasoning-log");
    const p = document.createElement("p");
    p.textContent = `${sender}: ${message}`;
    reasonLog.appendChild(p);
    reasonLog.scrollTop = reasonLog.scrollHeight;
}

export function createBoardUI() {
    const boardElement = document.getElementById("game-board");
    boardElement.innerHTML = '';
    for (let i = 0; i < 19; i++) {
        const lineH = document.createElement("div"); lineH.className = "line horizontal-line"; lineH.style.top = `${i * 30 + 15}px`; boardElement.appendChild(lineH);
        const lineV = document.createElement("div"); lineV.className = "line vertical-line"; lineV.style.left = `${i * 30 + 15}px`; boardElement.appendChild(lineV);
    }
    for (let i = 0; i < 19; i++) {
        const colLabel = document.createElement("div"); colLabel.className = "coordinate-label top-label"; colLabel.style.left = `${i * 30 + 15}px`; colLabel.textContent = String.fromCharCode(65 + i); boardElement.appendChild(colLabel);
        const rowLabel = document.createElement("div"); rowLabel.className = "coordinate-label left-label"; rowLabel.style.top = `${i * 30 + 15}px`; rowLabel.textContent = i + 1; boardElement.appendChild(rowLabel);
    }
    // 화점(Star points) 추가
    const hwajeomCoords = [
        [3, 3], [3, 9], [3, 15],
        [9, 3], [9, 9], [9, 15],
        [15, 3], [15, 9], [15, 15]
    ];
    hwajeomCoords.forEach(([row, col]) => {
        const dot = document.createElement("div");
        dot.className = "hwajeom-dot";
        dot.style.left = `${col * 30 + 15}px`;
        dot.style.top = `${row * 30 + 15}px`;
        boardElement.appendChild(dot);
    });
}

// ui.js 파일의 showEndGameMessage 함수를 아래 코드로 전체 교체해주세요.

export function showEndGameMessage(eventData, resetGameCallback) {
    // 기존에 표시된 게임 종료 메시지가 있다면 삭제합니다.
    const existingMsg = document.getElementById('game-over-message');
    if (existingMsg) {
        existingMsg.remove();
    }

    const boardElement = document.getElementById('game-board');
    const msgDiv = document.createElement('div');
    msgDiv.id = 'game-over-message';

    // 1. 메인 메시지 생성
    const mainMessage = document.createElement('div');
    mainMessage.className = 'main-message';
    mainMessage.textContent = eventData.message;
    msgDiv.appendChild(mainMessage);

    // 2. 경험치 및 루나 상세 정보가 있을 경우
    if (eventData.xpResult && eventData.oldUserData) {
        // --- ▼▼▼ 바로 이 한 줄이 누락되었을 가능성이 높습니다 ▼▼▼ ---
        const result = eventData.xpResult; 
        // --- ▲▲▲ 'result' 변수를 여기서 선언해야 합니다 ▲▲▲ ---
        
        const oldData = eventData.oldUserData;
        const oldXp = oldData.experience || 0;
        const totalNewXp = oldXp + result.xpGained;

        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'xp-details';
        
        // 획득 경험치
        let xpGainedText = getString('game_over_xp_gained', { xpGained: result.xpGained });
        if (result.didGetDailyBonus) {
            xpGainedText += ` ${getString('game_over_daily_bonus')}`;
        }
        const xpGainedEl = document.createElement('p');
        xpGainedEl.textContent = xpGainedText;
        detailsContainer.appendChild(xpGainedEl);

        // 경험치 변화
        const requiredXpForOldLevel = getRequiredXpForLevel(oldData.level || 1);
        const xpChangeEl = document.createElement('p');
        let newXpForDisplay, requiredXpForNewLevel;

        if (result.didLevelUp) {
            requiredXpForNewLevel = getRequiredXpForLevel(result.newLevel);
            newXpForDisplay = totalNewXp - requiredXpForOldLevel;
        } else {
            requiredXpForNewLevel = requiredXpForOldLevel;
            newXpForDisplay = totalNewXp;
        }
        xpChangeEl.textContent = getString('game_over_xp_change', {
            oldXp: oldXp,
            reqOld: requiredXpForOldLevel,
            newXp: newXpForDisplay,
            reqNew: requiredXpForNewLevel
        });
        detailsContainer.appendChild(xpChangeEl);

        // 현재 레벨
        const currentLevelEl = document.createElement('p');
        currentLevelEl.textContent = getString('game_over_current_level', { level: result.newLevel });
        detailsContainer.appendChild(currentLevelEl);
        
        // 루나 결과 표시 로직
        if (result.lunaGained !== undefined) {
            const oldLuna = oldData.luna || 0;
            const newLuna = oldLuna + result.lunaGained;

            const lunaGainedEl = document.createElement('p');
            lunaGainedEl.textContent = getString('game_over_luna_gained', { lunaGained: result.lunaGained });

            const lunaChangeEl = document.createElement('p');

            lunaChangeEl.textContent = getString('game_over_luna_change', { oldLuna, newLuna });

            // 경험치와 루나 정보 사이에 구분선 추가
            const divider = document.createElement('hr');
            divider.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            divider.style.margin = '10px 0';

            detailsContainer.appendChild(divider);
            detailsContainer.appendChild(lunaGainedEl);
            detailsContainer.appendChild(lunaChangeEl);
        }

        msgDiv.appendChild(detailsContainer);
    }
    
    // 3. '새 게임' 버튼 생성
    const newGameButton = document.createElement('button');
    newGameButton.className = 'new-game-button-modal';
    newGameButton.textContent = getString('new_game_btn'); 
    
    if (resetGameCallback) {
        newGameButton.addEventListener('click', (event) => {
            event.stopPropagation(); 
            new Audio('sounds/Click.mp3').play();
            resetGameCallback();
        });
    }
    msgDiv.appendChild(newGameButton);
    
    boardElement.appendChild(msgDiv);
    requestAnimationFrame(() => msgDiv.classList.add('visible'));
}

// ... (파일의 나머지 부분은 그대로 유지) ...
export function updateAuthUI(user) {
    const guestDisplay = document.getElementById('guest-display');
    const userDisplay = document.getElementById('user-display');
    const nicknameDisplay = document.getElementById('nickname-display');
    if (user) {
        guestDisplay.style.display = 'none';
        userDisplay.style.display = 'flex';
        nicknameDisplay.textContent = getString('welcome_message', { nickname: user.nickname });
    } else {
        guestDisplay.style.display = 'flex';
        userDisplay.style.display = 'none';
    }
}

// ui.js 파일의 updateProfilePopup 함수를 아래 코드로 전체 교체해주세요.

export function updateProfilePopup(data) {
    const winsEl = document.getElementById('profile-wins');
    const lossesEl = document.getElementById('profile-losses');
    const drawsEl = document.getElementById('profile-draws');
    const winRateEl = document.getElementById('profile-win-rate');
    const levelInfoEl = document.getElementById('profile-level-info');
    const lunaBalanceEl = document.getElementById('profile-luna-balance'); // <-- 이 변수 선언이 중요합니다.
    const titleEl = document.getElementById('profile-popup-title');

    if (!data || !data.stats) return;

    const { wins = 0, losses = 0, draws = 0 } = data.stats;
    const totalGames = wins + losses + draws;
    const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

    winsEl.textContent = wins;
    lossesEl.textContent = losses;
    drawsEl.textContent = draws;
    winRateEl.textContent = `${winRate}%`;

    if (data.level !== undefined && data.experience !== undefined) {
        const requiredXp = getRequiredXpForLevel(data.level);
        levelInfoEl.textContent = getString('level_info_display', { level: data.level, currentXp: data.experience, requiredXp: requiredXp });
    } else {
        levelInfoEl.textContent = getString('level_info_display', { level: 1, currentXp: 0, requiredXp: getRequiredXpForLevel(1) });
    }
    
    const luna = data.luna || 0;
    // lunaBalanceEl이 null이 아닐 때만 업데이트 하도록 안전장치 추가
    if (lunaBalanceEl) {
        lunaBalanceEl.textContent = `${luna} ${getString('luna_unit')}`;
    }

    titleEl.textContent = data.nickname ? getString('profile_title_user', { nickname: data.nickname }) : getString('profile_title_guest');
}

// js/ui.js 파일의 맨 아래에 이 함수를 추가하세요.

export function getCurrentStrings() {
    return currentStrings;
}


/**
 * 사용자 데이터에 따라 레벨과 경험치 바 UI를 업데이트합니다.
 * @param {object | null} userData - 사용자 데이터 또는 null (로그아웃 시)
 */
export function updateLevelUI(userData) {
    const container = document.getElementById('level-bar-container');
    if (!userData || !userData.hasOwnProperty('level')) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    const level = userData.level || 1;
    const currentXp = userData.experience || 0;
    const requiredXp = getRequiredXpForLevel(level);

    const percentage = Math.min((currentXp / requiredXp) * 100, 100);

    const fillEl = document.getElementById('level-bar-fill');
    const textEl = document.getElementById('level-bar-text');

    fillEl.style.width = `${percentage}%`;
    textEl.textContent = `LV. ${level} (${currentXp} / ${requiredXp} XP)`;
}

/**
 * 레벨업 애니메이션과 사운드를 재생합니다.
 * @param {number} oldLevel - 이전 레벨
 * @param {number} newLevel - 새로 도달한 레벨
 */
export function showLevelUpAnimation(oldLevel, newLevel) {
    const overlay = document.getElementById('level-up-overlay');
    // [수정] 텍스트를 채워 넣을 요소를 모두 가져옵니다.
    const titleText = overlay.querySelector('.level-up-text');
    const transitionText = overlay.querySelector('.level-transition-text');
    const sound = document.getElementById('level-up-sound');

    // [수정] 다국어 파일에서 텍스트를 가져와 채웁니다.
    titleText.textContent = getString('level_up_title');
    transitionText.textContent = getString('level_up_transition', {
        oldLevel: oldLevel,
        newLevel: newLevel
    });

    overlay.classList.add('is-animating');
    sound.play();

    // 2.5초 후 애니메이션 클래스를 제거하여 오버레이를 다시 숨깁니다.
    setTimeout(() => {
        overlay.classList.remove('is-animating');
    }, 2500);
}

/**
 * 좌표(col, row)를 'A1'과 같은 형식의 문자로 변환합니다.
 * @param {number} col - 열 번호
 * @param {number} row - 행 번호
 * @returns {string} 변환된 좌표 문자열
 */
export function convertCoord(col, row) {
    return String.fromCharCode(65 + col) + (row + 1);
}