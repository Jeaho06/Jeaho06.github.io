// js/ui.js
import { getRequiredXpForLevel } from './firebase.js'; // [추가]
import { getStoneClasses } from './skinManager.js';
import { shopItems } from './shopItems.js';
let currentStrings = {};

export function setStrings(strings) {
    currentStrings = strings;
}

export function getString(key, replacements = {}) {
    // 번역 데이터가 아직 로드되지 않았다면, currentStrings[key]는 undefined가 됩니다.
    let str = currentStrings[key];

    // 번역 데이터를 찾지 못했을 경우의 처리
    if (str === undefined) {
        // [키 이름] 형식으로 반환하여 문제가 있음을 알림
        return `[${key}]`;
    }

    for (const placeholder in replacements) {
        str = str.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return str;
}

export function getInitializedString(key, replacements = {}) {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 30; // 최대 3초간 시도 (100ms * 30)

        const tryGetString = () => {
            const str = getString(key, replacements);
            // 번역에 성공했거나 (키가 그대로 반환되지 않았거나), 최대 시도 횟수를 넘었을 경우
            if (!str.startsWith('[') || attempts >= maxAttempts) {
                resolve(str); // 성공한 번역 또는 키 값을 반환하고 종료
            } else {
                attempts++;
                setTimeout(tryGetString, 100); // 0.1초 후 재시도
            }
        };
        tryGetString();
    });
}

// ▼▼▼ 이 함수는 남겨두세요 ▼▼▼
// ui.js
export function placeStone(col, row, color) {
    const boardElement = document.getElementById("stone-container");

    const lastStoneEl = document.querySelector('.last-move');
    if (lastStoneEl) lastStoneEl.classList.remove('last-move');

    const stone = document.createElement("div");

    stone.className = getStoneClasses(color);

    // [수정] 좌표 계산을 교차점의 정중앙(15px)으로 되돌립니다.
    // 최종 중앙 정렬은 game.css의 transform 속성이 처리합니다.
    const gridSize = 30;
    const centerOffset = gridSize / 2; // 15px

    stone.style.left = `${col * gridSize + centerOffset}px`;
    stone.style.top = `${row * gridSize + centerOffset}px`;
    
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
    if (!boardElement) return;

    // 1. 기존 내용을 모두 지웁니다.
    boardElement.innerHTML = '';

    // 2. 필수적인 자식 레이어들을 JavaScript로 다시 생성합니다.
    const startNotification = document.createElement('div');
    startNotification.id = 'game-start-notification';
    startNotification.className = 'hidden';
    startNotification.textContent = '게임 시작!';

    const policyVisualization = document.createElement('div');
    policyVisualization.id = 'ai-policy-visualization';

    const stoneContainer = document.createElement('div');
    stoneContainer.id = 'stone-container';
    
    // 3. 생성한 레이어들을 game-board에 추가합니다.
    boardElement.appendChild(startNotification);
    boardElement.appendChild(policyVisualization);
    boardElement.appendChild(stoneContainer);

    // 4. 이하 바둑판 선과 좌표를 그리는 로직은 기존과 동일합니다.
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
    if (!boardElement) return;

    const msgDiv = document.createElement('div');
    msgDiv.id = 'game-over-message';

    // 1. 메인 메시지 생성
    const mainMessage = document.createElement('div');
    mainMessage.className = 'main-message';
    mainMessage.textContent = eventData.message;
    msgDiv.appendChild(mainMessage);

    // 2. 경험치 및 루나 상세 정보가 있을 경우
    if (eventData.xpResult && eventData.oldUserData) {
        const result = eventData.xpResult; 
        const oldData = eventData.oldUserData;
        const oldXp = oldData.experience || 0;
        
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'xp-details';
        
        // 획득 경험치
        let xpGainedText = getString('game_over_xp_gained', { xpGained: result.xpGained });
        if (result.bonusXp > 0) {
            xpGainedText += ` (반칙 보너스 +${result.bonusXp}!)`;
        }
        if (result.didGetDailyBonus) {
            xpGainedText += ` ${getString('game_over_daily_bonus')}`;
        }
        const xpGainedEl = document.createElement('p');
        xpGainedEl.textContent = xpGainedText;
        detailsContainer.appendChild(xpGainedEl);

        // [수정] 경험치 변화 표시 로직
        const xpChangeEl = document.createElement('p');
        const requiredXpForOldLevel = getRequiredXpForLevel(oldData.level || 1);
        const requiredXpForNewLevel = getRequiredXpForLevel(result.newLevel);
        
        // Firebase 트랜잭션의 최종 결과값을 직접 사용 (로컬 재계산 제거)
        const newXpForDisplay = result.newExperience;

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
            let lunaGainedText = getString('game_over_luna_gained', { lunaGained: result.lunaGained });
            if (result.bonusLuna > 0) {
                lunaGainedText += ` (반칙 보너스 +${result.bonusLuna}!)`;
            }
            const lunaGainedEl = document.createElement('p');
            lunaGainedEl.textContent = lunaGainedText;
            const lunaChangeEl = document.createElement('p');
            lunaChangeEl.textContent = getString('game_over_luna_change', { oldLuna, newLuna });

            const divider = document.createElement('hr');
            divider.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            divider.style.margin = '10px 0';
            detailsContainer.appendChild(divider);
            detailsContainer.appendChild(lunaGainedEl);
            detailsContainer.appendChild(lunaChangeEl);
        }

        msgDiv.appendChild(detailsContainer);
    }
    
    // 3. 버튼들을 담을 컨테이너 생성
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'game-over-buttons';

    // '새 게임' 버튼 생성
    const newGameButton = document.createElement('button');
    newGameButton.className = 'new-game-button-modal';
    newGameButton.textContent = getString('new_game_btn'); 
    if (resetGameCallback) {
        newGameButton.addEventListener('click', (event) => {
            event.stopPropagation(); 
            new Audio('/sounds/Click.mp3').play();
            resetGameCallback();
        });
    }
    buttonContainer.appendChild(newGameButton);
    
    // '로비로 가기' 버튼 추가
    const lobbyButton = document.createElement('button');
    lobbyButton.className = 'new-game-button-modal';
    lobbyButton.textContent = getString('go_to_lobby_btn');
    lobbyButton.addEventListener('click', (event) => {
        event.stopPropagation();
        new Audio('/sounds/Click.mp3').play();
        window.location.href = '/index.html';
    });
    buttonContainer.appendChild(lobbyButton);

    // 버튼 컨테이너를 메인 div에 추가
    msgDiv.appendChild(buttonContainer);
    
    boardElement.appendChild(msgDiv);
    requestAnimationFrame(() => msgDiv.classList.add('visible'));
}

// ... (파일의 나머지 부분은 그대로 유지) ...
export function updateAuthUI(user, guestData = null) {
    const guestDisplay = document.getElementById('guest-display');
    const userDisplay = document.getElementById('user-display');
    const nicknameDisplay = document.getElementById('nickname-display');
    
    // ▼▼▼ 제어할 모든 버튼을 가져옵니다 ▼▼▼
    const newGameButton = document.getElementById('new-game-button');
    const logoutButton = document.getElementById('logout-button');
    const profileButton = document.getElementById('profile-button');
    const updateButton = document.getElementById('update-button');
    const languageSwitcher = document.querySelector('.language-switcher');
    
    if (!guestDisplay || !userDisplay) return;
    
    if (user) { // 로그인 상태
        guestDisplay.style.display = 'none';
        userDisplay.style.display = 'flex';
        if(nicknameDisplay) nicknameDisplay.textContent = getString('welcome_message', { nickname: user.nickname });
        
        // 모든 버튼을 'inline-block'으로 표시하여 자리를 차지하게 함
        if (newGameButton) newGameButton.style.display = 'inline-block';
        if (logoutButton) logoutButton.style.display = 'inline-block';
        if (profileButton) profileButton.style.display = 'inline-block';
        if (updateButton) updateButton.style.display = 'inline-block';
        if (languageSwitcher) languageSwitcher.style.display = 'inline-block';

    } else { // 게스트 상태
        guestDisplay.style.display = 'flex';
        userDisplay.style.display = 'none';
        
        // '새 게임'과 '로그아웃' 버튼만 숨김
        if (newGameButton) newGameButton.style.display = 'none';
        if (logoutButton) logoutButton.style.display = 'none';

        // 나머지 버튼들은 보이도록 설정 (로비/게임 페이지 공통)
        if (profileButton) profileButton.style.display = 'inline-block';
        if (updateButton) updateButton.style.display = 'inline-block';
        if (languageSwitcher) languageSwitcher.style.display = 'inline-block';
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

    const isGamePage = !!document.getElementById('game-board');
    const cheatStatsSection = document.getElementById('stats-by-cheat-grid')?.parentNode;

    if (cheatStatsSection) {
        // 게임 페이지이면 상세 전적 섹션을 숨기고, 아니면(로비이면) 보여줍니다.
        cheatStatsSection.style.display = isGamePage ? 'none' : 'block';
    }

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

    if (!container) return; // 'level-bar-container'가 없으면 함수를 즉시 종료

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
/**
 * 로비의 '내 정보 요약' 사이드바를 사용자 데이터로 업데이트합니다.
 * @param {object | null} data - 사용자 데이터 또는 게스트 데이터
 */
export function updateLobbySidebar(data) {
    // ▼▼▼ 닉네임, 레벨, 승패, 루나 요소를 모두 가져옵니다. ▼▼▼
    const nicknameEl = document.getElementById('summary-nickname');
    const levelEl = document.getElementById('stat-level');
    const winsEl = document.getElementById('stat-wins');
    const lossesEl = document.getElementById('stat-losses');
    const lunaEl = document.getElementById('stat-luna');

    // 로비 페이지가 아니면(요소가 하나라도 없으면) 아무것도 하지 않고 종료
    if (!nicknameEl || !levelEl || !winsEl || !lossesEl || !lunaEl) {
        return;
    }

    // ▼▼▼ 데이터 유무에 따라 정보를 채워 넣습니다. ▼▼▼
    if (data) {
        // 닉네임 설정 (data.nickname이 있으면 그 값을, 없으면 'Guest'로)
        nicknameEl.textContent = data.nickname || 'Guest';

        // 레벨, 승패, 루나 설정
        levelEl.textContent = data.level || 1;
        winsEl.textContent = data.stats?.wins || 0; // data.stats가 없을 경우를 대비
        lossesEl.textContent = data.stats?.losses || 0;
        lunaEl.textContent = data.luna ?? 0; // 0도 표시되도록
    } else {
        // 데이터가 아예 없는 경우 (예: 로딩 실패) 기본값으로 설정
        nicknameEl.textContent = 'Guest';
        levelEl.textContent = '1';
        winsEl.textContent = '0';
        lossesEl.textContent = '0';
        lunaEl.textContent = '100'; // 게스트 초기 루나
    }
}

/**
 * 플레이어 정보 박스의 스킨 표시를 업데이트합니다.
 * @param {object | null} currentData - 현재 플레이어의 데이터 (로그인 유저 또는 게스트)
 */
export function updatePlayerInfoBox(currentData) {
    const displayElement = document.getElementById('player-skin-display');
    if (!displayElement) return; // 정보 박스가 없으면 종료

    // 장착한 스킨의 ID를 가져옵니다.
    const equippedSkinId = currentData?.equippedItems?.stone_skin;

    if (equippedSkinId) {
        // ID를 이용해 shopItems에서 전체 아이템 정보를 찾습니다.
        const equippedItem = shopItems.find(item => item.id === equippedSkinId);
        if (equippedItem) {
            // 아이템 정보가 있으면 이름으로 표시
            displayElement.textContent = equippedItem.name;
        } else {
            // 아이템 정보는 없는데 ID만 있는 경우 (오류 상황)
            displayElement.textContent = getString('default_skin_name');
        }
    } else {
        // 장착한 스킨이 없으면 '기본 스킨'으로 표시
        displayElement.textContent = getString('default_skin_name');
    }
}