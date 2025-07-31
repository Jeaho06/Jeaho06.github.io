// js/cheats/placeBomb.js

import { placeStone, logMove, logReason, getString, convertCoord } from '../ui.js';

/**
 * AI가 '폭탄 설치' 스킬을 실행합니다.
 * @param {object} context - 게임의 현재 상태와 필요한 함수들
 * @returns {boolean} 스킬이 성공적으로 사용되었으면 true
 */
export function executePlaceBomb(context) {
    const { board, playSfx, updateWinRate, findBestMove, moveCount } = context;
    // [수정] 새로운 findBestBombLocation 함수를 사용합니다.
    const move = findBestBombLocation(board); 

    if (move) {
        board[move.row][move.col] = 2; // 2는 폭탄
        context.bombState.isArmed = true;
        context.bombState.col = move.col;
        context.bombState.row = move.row;
        
        placeStone(move.col, move.row, 'bomb');
        playSfx('install');
        
        const bombCoord = convertCoord(move.col, move.row);
        logMove(moveCount + 1, `${getString('ai_title')}: ${bombCoord}!!`);
        logReason(getString('ai_title'), getString('ai_bomb_place_reason', { coord: bombCoord }));
        
        context.isAITurn = false;
        const { score } = findBestMove();
        updateWinRate(score, moveCount + 1);
        return true;
    }
    return false;
}

// [수정] 보내주신 기존 코드로 교체합니다.
function findBestBombLocation(board) {
    let bestLocation = null; 
    let maxScore = -Infinity;
    for (let r = 0; r < 19; r++) {
        for (let c = 0; c < 19; c++) {
            if (board[r][c] === 0) {
                let currentScore = 0;
                for (let y = r - 1; y <= r + 1; y++) {
                    for (let x = c - 1; x <= c + 1; x++) {
                        if (y >= 0 && y < 19 && x >= 0 && x < 19) {
                            if (board[y][x] === 1) { // 상대 돌 주변
                                currentScore += 3; 
                                if (isCriticalStone(x, y, 1, board)) currentScore += 5; // 상대의 중요 돌 주변이면 가중치
                            } else if (board[y][x] === -1) { // 내 돌 주변
                                currentScore -= 1;
                            }
                        }
                    }
                }
                if (currentScore > maxScore) {
                    maxScore = currentScore;
                    bestLocation = { col: c, row: r };
                }
            }
        }
    }
    return maxScore > 0 ? bestLocation : null;
}

// [추가] findBestBombLocation이 사용하는 헬퍼 함수입니다.
function isCriticalStone(x, y, player, board) {
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dx, dy] of directions) {
        let count = 1;
        // 정방향
        for(let i=1; i<4; i++){ 
            const nx = x + i * dx, ny = y + i * dy; 
            if(nx<0||nx>=19||ny<0||ny>=19||board[ny][nx] !== player) break; 
            count++;
        }
        // 역방향
        for(let i=1; i<4; i++){ 
            const nx = x - i * dx, ny = y - i * dy; 
            if(nx<0||nx>=19||ny<0||ny>=19||board[ny][nx] !== player) break; 
            count++;
        }
        if (count >= 3) return true; // 3개 이상 연결된 돌은 중요하다고 판단
    }
    return false;
}