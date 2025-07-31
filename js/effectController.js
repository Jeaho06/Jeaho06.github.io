import { playSfx } from './audioManager.js';


let effectsEnabled = true;

export function initializeEffectSettings() {
    const savedSetting = localStorage.getItem('omokEffectsEnabled');
    // 저장된 값이 없으면 true, 있으면 해당 값을 boolean으로 변환하여 사용
    effectsEnabled = savedSetting === null ? true : (savedSetting === 'true');
}

/**
 * 외부(설정 팝업 등)에서 이펙트 설정을 변경하는 함수
 * @param {boolean} isEnabled 
 */
export function setEffectsEnabled(isEnabled) {
    effectsEnabled = isEnabled;
    localStorage.setItem('omokEffectsEnabled', effectsEnabled);
}

/**
 * 메인 함수: 이펙트 설정이 켜져 있을 때만 감지 및 연출을 실행합니다.
 * @param {object} context - { board, row, col, player } 게임 상태 정보
 */
export function checkAndPlayEffects(context) {
    // ▼▼▼ 설정이 꺼져 있으면 함수를 즉시 종료 ▼▼▼
    if (!effectsEnabled) {
        return;
    }

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
// --- 내부 헬퍼 함수들 (private) ---

/**
 * '열린 4' 필살기 연출 (텍스트 없는 궁극기 버전)
 */
function _showOpenFourWinEffect(data) {
    playSfx('win_special');

    const boardElement = document.getElementById('game-board');
    if (!boardElement) return;

    // 1. 화면을 어둡게 덮는 배경 생성
    const darkOverlay = document.createElement('div');
    darkOverlay.className = 'effect-win-overlay';
    document.body.appendChild(darkOverlay);

    // 2. 승리한 돌들을 연결하는 빛줄기 생성
    const lineEffect = document.createElement('div');
    lineEffect.className = 'effect-win-line-ultimate';
    boardElement.appendChild(lineEffect);

    // 3. 화면 전체에 퍼지는 광선 효과 추가
    const burstEffect = document.createElement('div');
    burstEffect.className = 'effect-ultimate-burst-win';
    document.body.appendChild(burstEffect);
    
    // 4. 빛줄기 위치와 각도 계산
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
    
    // 5. 광선 효과의 중심점 계산 및 설정
    const rect = boardElement.getBoundingClientRect();
    const centerX = rect.left + (startX + endX) / 2;
    const centerY = rect.top + (startY + endY) / 2;
    burstEffect.style.setProperty('--effect-x', `${centerX}px`);
    burstEffect.style.setProperty('--effect-y', `${centerY}px`);

    // 6. 애니메이션이 끝난 후 모든 효과 요소 제거
    setTimeout(() => {
        darkOverlay.remove();
        lineEffect.remove();
        burstEffect.remove();
    }, 2000); // 2초 후 제거
}

function _showClosedFourEffect(data) {
    playSfx('closed_four');
    // ... (이하 이전에 만들었던 '닫힌 4' 연출 코드와 동일) ...
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

/**
 * [새로 추가] 개발자용 테스트 함수. 이름으로 직접 연출을 재생합니다.
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
