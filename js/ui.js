// js/ui.js

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
}

export function showEndGameMessage(message) {
    const boardElement = document.getElementById('game-board');
    const msgDiv = document.createElement('div');
    msgDiv.id = 'game-over-message';
    msgDiv.textContent = message;
    boardElement.appendChild(msgDiv);
    requestAnimationFrame(() => msgDiv.classList.add('visible'));
}

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

export function updateProfilePopup(data) {
    const winsEl = document.getElementById('profile-wins');
    const lossesEl = document.getElementById('profile-losses');
    const drawsEl = document.getElementById('profile-draws');
    const winRateEl = document.getElementById('profile-win-rate');
    const titleEl = document.getElementById('profile-popup-title');

    if (!data || !data.stats) return;
    const { wins = 0, losses = 0, draws = 0 } = data.stats;
    const totalGames = wins + losses + draws;
    const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

    winsEl.textContent = wins;
    lossesEl.textContent = losses;
    drawsEl.textContent = draws;
    winRateEl.textContent = `${winRate}%`;
    titleEl.textContent = data.nickname ? getString('profile_title_user', { nickname: data.nickname }) : getString('profile_title_guest');
}

// js/ui.js 파일의 맨 아래에 이 함수를 추가하세요.

export function getCurrentStrings() {
    return currentStrings;
}
