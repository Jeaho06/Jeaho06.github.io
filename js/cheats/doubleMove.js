/**
 * AI가 '2번 두기' 스킬을 실행합니다.
 * @param {object} context - 게임의 현재 상태와 필요한 함수들
 * @returns {boolean} 스킬이 사용되었음을 나타내는 true
 */
export function executeDoubleMove(context) {
    const { performNormalMove, gameOver } = context;

    performNormalMove(); // 첫 번째 수
    if (gameOver()) return true; // 첫 수로 게임이 끝나도 치트 사용은 성공한 것이므로 true 반환

    setTimeout(() => {
        if (gameOver()) return;
        performNormalMove(); // 두 번째 수
    }, 800); // 약간의 텀을 두고 실행

    // 이 return true는 game.js의 aiMove 함수에게 
    // '치트 스킬이 성공적으로 시작되었으니, 추가로 일반 착수를 하지 말고 턴을 마쳐라'고
    // 알려주는 중요한 역할을 합니다.
    return true;
}