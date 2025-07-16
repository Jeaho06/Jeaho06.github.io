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

export function showEndGameMessage(eventData, resetGameCallback) {
    // 기존에 표시된 게임 종료 메시지가 있다면 삭제합니다.
    const existingMsg = document.getElementById('game-over-message');
    if (existingMsg) {
        existingMsg.remove();
    }

    const boardElement = document.getElementById('game-board');
    const msgDiv = document.createElement('div');
    msgDiv.id = 'game-over-message';

    // 1. 메인 메시지 (예: "AI가 승리했습니다!")를 생성하여 추가합니다.
    const mainMessage = document.createElement('div');
    mainMessage.className = 'main-message';
    mainMessage.textContent = eventData.message;
    msgDiv.appendChild(mainMessage);

    // 2. 경험치 상세 정보가 있을 경우(로그인 상태), 이를 담는 컨테이너를 만들어 추가합니다.
    if (eventData.xpResult && eventData.oldUserData) {
        const xpResult = eventData.xpResult;
        const oldData = eventData.oldUserData;
        const oldXp = oldData.experience || 0;
        const oldLevel = oldData.level || 1;
        const totalNewXp = oldXp + xpResult.xpGained;

        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'xp-details';
        
        // 획득 경험치
        let xpGainedText = getString('game_over_xp_gained', { xpGained: xpResult.xpGained });
        if (xpResult.didGetDailyBonus) {
            xpGainedText += ` ${getString('game_over_daily_bonus')}`;
        }
        const xpGainedEl = document.createElement('p');
        xpGainedEl.textContent = xpGainedText;
        detailsContainer.appendChild(xpGainedEl);

        // 경험치 변화
        const requiredXpForOldLevel = getRequiredXpForLevel(oldLevel);
        const xpChangeEl = document.createElement('p');
        let newXpForDisplay, requiredXpForNewLevel;

        if (xpResult.didLevelUp) {
            requiredXpForNewLevel = getRequiredXpForLevel(xpResult.newLevel);
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
        const finalLevel = xpResult.didLevelUp ? xpResult.newLevel : oldLevel;
        currentLevelEl.textContent = getString('game_over_current_level', { level: finalLevel });
        detailsContainer.appendChild(currentLevelEl);

                // ▼▼▼ 여기에 루나 결과 표시 로직 추가 ▼▼▼
        if (result.lunaGained !== undefined) {
            const oldLuna = eventData.oldUserData.luna || 0;
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
        // ▲▲▲ 여기까지 추가 ▲▲▲

        // 완성된 경험치 컨테이너를 메시지 창에 추가합니다.
        msgDiv.appendChild(detailsContainer);
    }
    
    // 3. '새 게임' 버튼을 생성하여 경험치 정보 아래에 추가합니다.
    const newGameButton = document.createElement('button');
    newGameButton.className = 'new-game-button-modal';
    newGameButton.textContent = getString('new_game_btn'); 
    
    // ▼▼▼ 버튼 클릭 로직을 아래와 같이 간결하게 수정 ▼▼▼
    // 콜백 함수가 있으면 버튼에 바로 연결합니다.
    // resetGame 함수가 보드 클리어를 포함한 모든 초기화를 담당하므로 가장 안정적입니다.
    if (resetGameCallback) {
        // ▼▼▼ 바로 이 부분을 수정해야 합니다! ▼▼▼
        newGameButton.addEventListener('click', (event) => {
            // 클릭 이벤트가 바둑판까지 전달되는 것을 막습니다.
            event.stopPropagation(); 
            // 게임을 리셋하는 원래 함수를 호출합니다.
            new Audio('sounds/Click.mp3').play();
            resetGameCallback();
        });
        // ▲▲▲ 여기까지 입니다 ▲▲▲
    }
    msgDiv.appendChild(newGameButton);
    
    // 최종적으로 완성된 메시지 창을 게임 보드에 추가합니다.
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