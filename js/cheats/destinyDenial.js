import { getString, convertCoord, logMove, logReason } from '../ui.js';

/**
 * AI가 사용자의 결정적인 수(오목)를 거부하는 '거부권' 스킬을 실행합니다.
 * @param {object} context - 게임의 현재 상태와 필요한 함수들
 * @returns {boolean} 스킬이 사용되었으면 true, 아니면 false
 */
export function executeDestinyDenial(context) {
    // context에서 isVetoActive (거부권 활성화 여부)를 추가로 받아옵니다.
    const { board, col, row, isWinningMove, isDestinyDenialUsed, moveCount, isVetoActive } = context;

    // [핵심 수정] UI의 체크박스를 확인하는 대신, 전달받은 isVetoActive 변수를 확인합니다.
    if (isWinningMove && !isDestinyDenialUsed && isVetoActive) {
        context.isDestinyDenialUsed = true; // 스킬 사용으로 상태 변경
        board[row][col] = 3; // 3은 거부된 위치를 의미
        
        const deniedSpot = document.createElement("div");
        deniedSpot.className = "denied-spot";
        const gridSize = 30;
        deniedSpot.style.left = `${col * gridSize + gridSize / 2}px`;
        deniedSpot.style.top = `${row * gridSize + gridSize / 2}px`;
        
        // game-board가 존재할 때만 요소를 추가하도록 안전장치 추가
        document.getElementById("game-board")?.appendChild(deniedSpot);
        
        const deniedCoord = convertCoord(col, row);
        logMove(moveCount + 1, `${getString('ai_title')}: ${getString('cheat_veto')}!!`);
        logReason(getString('ai_title'), getString('ai_veto_reason', {coord: deniedCoord}));
        
        return true;
    }
    
    return false;
}