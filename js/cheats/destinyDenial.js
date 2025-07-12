import { placeStone, logMove, logReason, getString, convertCoord } from '../ui.js';

/**
 * AI가 사용자의 결정적인 수(오목)를 거부하는 '거부권' 스킬을 실행합니다.
 * @param {object} context - 게임의 현재 상태와 필요한 함수들
 * @returns {boolean} 스킬이 사용되었으면 true, 아니면 false
 */
export function executeDestinyDenial(context) {
    const { board, col, row, isWinningMove, isDestinyDenialUsed, moveCount } = context;

    if (isWinningMove && !isDestinyDenialUsed && document.getElementById('toggle-destiny-denial').checked) {
        context.isDestinyDenialUsed = true; // 스킬 사용으로 상태 변경
        board[row][col] = 3; // 3은 거부된 위치를 의미
        
        const deniedSpot = document.createElement("div");
        deniedSpot.className = "denied-spot";
        const gridSize = 30;
        deniedSpot.style.left = `${col * gridSize + gridSize / 2}px`;
        deniedSpot.style.top = `${row * gridSize + gridSize / 2}px`;
        document.getElementById("game-board").appendChild(deniedSpot);
        
        const deniedCoord = convertCoord(col, row);
        logMove(moveCount + 1, `${getString('ai_title')}: ${getString('cheat_veto')}!!`);
        logReason(getString('ai_title'), getString('ai_veto_reason', {coord: deniedCoord}));
        
        // 거부권 사용 후 AI 턴으로 넘기지 않고 사용자 턴을 유지해야 하므로,
        // 이 함수를 호출한 곳에서 AI 턴 로직이 실행되지 않도록 true를 반환합니다.
        return true;
    }
    return false;
}