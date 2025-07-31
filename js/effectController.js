import { playSfx } from './audioManager.js';

// --- 설정 관련 ---
let effectsEnabled = true;

export function initializeEffectSettings() {
    const savedSetting = localStorage.getItem('omokEffectsEnabled');
    effectsEnabled = savedSetting === null ? true : (savedSetting === 'true');
}

export function setEffectsEnabled(isEnabled) {
    effectsEnabled = isEnabled;
    localStorage.setItem('omokEffectsEnabled', effectsEnabled);
}

/**
 * [개발자용] 이름으로 직접 연출을 재생합니다.
 */
export function playEffectForTesting(eventName, data) {
    if (!effectsEnabled) {
        console.warn("효과가 꺼져있습니다. 테스트를 위해 설정을 켜주세요.");
        return;
    }
    switch (eventName) {
        case 'closed-four':
            _showClosedFourEffect(data);
            break;
        case 'open-four-win':
            _showOpenFourWinEffect(data);
            break;
        default:
            console.error(`'${eventName}' 이라는 이름의 연출은 없습니다.`);
            break;
    }
}

// --- 메인 함수 ---
export function checkAndPlayEffects(context) {
    if (!effectsEnabled || context.player !== 1) return;
    const { board, row, col, player } = context;

    const openFourLine = _checkOpenFour(board, row, col, player);
    if (openFourLine) {
        _showOpenFourWinEffect({ winningLine: openFourLine });
        return;
    }
    const closedFourLine = _checkClosedFour(board, row, col, player);
    if (closedFourLine) {
        _showClosedFourEffect({ row, col });
    }
}

// --- 연출 실행 함수들 ---

function _showOpenFourWinEffect(data) {
    playSfx('win_special');
    const boardElement = document.getElementById('game-board');
    if (!boardElement) return;

    const lineEffect = document.createElement('div');
    lineEffect.className = 'effect-win-line-ultimate';
    boardElement.appendChild(lineEffect);

    const burstEffect = document.createElement('div');
    burstEffect.className = 'effect-ultimate-burst-win';
    document.body.appendChild(burstEffect);

    const gridSize = 30;
    const firstStone = data.winningLine[0];
    const lastStone = data.winningLine[3];
    const startX = firstStone.col * gridSize + gridSize / 2;
    const startY = firstStone.row * gridSize + gridSize / 2;
    const endX = lastStone.col * gridSize + gridSize / 2;
    const endY = lastStone.row * gridSize + gridSize / 2;

    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    lineEffect.style.width = `${length}px`;
    lineEffect.style.left = `${startX}px`;
    lineEffect.style.top = `${startY}px`;
    lineEffect.style.transform = `rotate(${angle}deg)`;
    lineEffect.style.transformOrigin = '0 0';

    const rect = boardElement.getBoundingClientRect();
    const centerX = rect.left + (startX + endX) / 2;
    const centerY = rect.top + (startY + endY) / 2;
    burstEffect.style.setProperty('--effect-x', `${centerX}px`);
    burstEffect.style.setProperty('--effect-y', `${centerY}px`);

    setTimeout(() => {
        lineEffect.remove();
        burstEffect.remove();
    }, 2200);
}

function _showClosedFourEffect(data) {
    playSfx('closed_four');
    const boardElement = document.getElementById('game-board');
    if (!boardElement) return;
    const effectElement = document.createElement('div');
    effectElement.className = 'effect-closed-four';
    const gridSize = 30;
    effectElement.style.top = `${data.row * 30 + gridSize / 2}px`;
    effectElement.style.left = `${data.col * 30 + gridSize / 2}px`;
    boardElement.appendChild(effectElement);
    setTimeout(() => {
        effectElement.remove();
    }, 1500);
}

// --- 감지 로직 함수들 ---

function _checkOpenFour(board, row, col, player) {
    const directions = [{r:0, c:1}, {r:1, c:0}, {r:1, c:1}, {r:1, c:-1}];
    for (const dir of directions) {
        for (let i = 0; i < 4; i++) {
            const startR = row - i * dir.r;
            const startC = col - i * dir.c;
            const line = [];
            let isValid = true;
            for (let j = 0; j < 4; j++) {
                const r = startR + j * dir.r;
                const c = startC + j * dir.c;
                if (r < 0 || r >= 19 || c < 0 || c >= 19 || board[r][c] !== player) {
                    isValid = false;
                    break;
                }
                line.push({ row: r, col: c });
            }

            if (isValid) {
                const beforeR = startR - dir.r;
                const beforeC = startC - dir.c;
                const afterR = startR + 4 * dir.r;
                const afterC = startC + 4 * dir.c;
                
                const isBeforeOpen = beforeR >= 0 && beforeR < 19 && beforeC >= 0 && beforeC < 19 && board[beforeR][beforeC] === 0;
                const isAfterOpen = afterR >= 0 && afterR < 19 && afterC >= 0 && afterC < 19 && board[afterR][afterC] === 0;

                if (isBeforeOpen && isAfterOpen) return line;
            }
        }
    }
    return null;
}

function _checkClosedFour(board, row, col, player) {
    const opponent = -player;
    const directions = [{r:0, c:1}, {r:1, c:0}, {r:1, c:1}, {r:1, c:-1}];
    for (const dir of directions) {
        for (let i = 0; i < 4; i++) {
            const startR = row - i * dir.r;
            const startC = col - i * dir.c;
            const line = [];
            let isValid = true;
            for (let j = 0; j < 4; j++) {
                const r = startR + j * dir.r;
                const c = startC + j * dir.c;
                if (r < 0 || r >= 19 || c < 0 || c >= 19 || board[r][c] !== player) {
                    isValid = false;
                    break;
                }
                line.push({ row: r, col: c });
            }

            if (isValid) {
                const beforeR = startR - dir.r;
                const beforeC = startC - dir.c;
                const afterR = startR + 4 * dir.r;
                const afterC = startC + 4 * dir.c;

                const isBeforeOpen = beforeR >= 0 && beforeR < 19 && beforeC >= 0 && beforeC < 19 && board[beforeR][beforeC] === 0;
                const isAfterOpen = afterR >= 0 && afterR < 19 && afterC >= 0 && afterC < 19 && board[afterR][afterC] === 0;
                const isBeforeBlocked = beforeR < 0 || beforeR >= 19 || beforeC < 0 || beforeC >= 19 || board[beforeR][beforeC] === opponent;
                const isAfterBlocked = afterR < 0 || afterR >= 19 || afterC < 0 || afterC >= 19 || board[afterR][afterC] === opponent;

                if ((isBeforeOpen && isAfterBlocked) || (isBeforeBlocked && isAfterOpen)) return line;
            }
        }
    }
    return null;
}