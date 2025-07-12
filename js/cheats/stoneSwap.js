// js/cheats/stoneSwap.js

// [수정] ui.js에서 직접 import하는 대신, 모든 함수를 context로부터 받습니다.
// import { removeStone, placeStone, logMove, logReason, getString, convertCoord } from '../ui.js';

/**
 * AI가 '돌 바꾸기' 스킬을 실행합니다.
 * @param {object} context - 게임의 현재 상태와 필요한 함수들
 * @returns {boolean} 스킬이 성공적으로 사용되었으면 true
 */
// js/cheats/stoneSwap.js

export function executeStoneSwap(context) {
    // [수정] context에서 passTurnToPlayer 함수를 받아옵니다.
    const { board, lastMove, playSound, updateWinRate, findBestMove, endGame, checkWin, moveCount, calculateScore, removeStone, placeStone, convertCoord, logMove, logReason, getString, passTurnToPlayer } = context;

    if (!lastMove) return false;
    
    const userStone = lastMove;
    const aiStoneToSwap = findBestSwapTarget(board, userStone, calculateScore); 

    if (aiStoneToSwap) {
        const userCoord = convertCoord(userStone.col, userStone.row);
        const aiCoord = convertCoord(aiStoneToSwap.col, aiStoneToSwap.row);
        
        logMove(moveCount + 1, `${getString('ai_title')}: ${userCoord}↔${aiCoord}!!`);
        logReason(getString('ai_title'), getString('ai_swap_reason', { userCoord, aiCoord }));
        
        removeStone(userStone.col, userStone.row);
        removeStone(aiStoneToSwap.col, aiStoneToSwap.row);
        
        setTimeout(() => {
            board[userStone.row][userStone.col] = -1;
            board[aiStoneToSwap.row][aiStoneToSwap.col] = 1;
            
            placeStone(userStone.col, userStone.row, 'white');
            placeStone(aiStoneToSwap.col, aiStoneToSwap.row, 'black');
            
            playSound("Movement.mp3");
            if (checkWin(board, -1)) {
                endGame(getString('system_ai_win'));
            } else {
                // [수정] context.isAITurn = false 대신, 전달받은 함수를 호출합니다.
                passTurnToPlayer(); 
                const { score } = findBestMove();
                updateWinRate(score, moveCount + 1);
            }
        }, 500);
        return true;
    }
    return false;
}

// 이 함수는 변경할 필요 없습니다.
function findBestSwapTarget(board, userStone, calculateScore) {
    let bestSwap = { stoneToSwap: null, netAdvantage: -Infinity };

    for (let r = 0; r < 19; r++) {
        for (let c = 0; c < 19; c++) {
            if (board[r][c] === -1) {
                const aiStone = { col: c, row: r };
                
                const aiGain = calculateScore(userStone.col, userStone.row, -1).totalScore;
                const userGain = calculateScore(aiStone.col, aiStone.row, 1).totalScore;
                const netAdvantage = aiGain - userGain;

                if (netAdvantage > bestSwap.netAdvantage) {
                    bestSwap = { stoneToSwap: aiStone, netAdvantage };
                }
            }
        }
    }
    return bestSwap.stoneToSwap;
}