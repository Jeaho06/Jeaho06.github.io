// js/winRateManager.js

// --- 모듈 상태 관리 ---
// 승률 기록을 저장하는 배열
let winRateHistory = [];

/**
 * 승률 기록과 그래프를 초기 상태로 리셋합니다.
 */
export function resetWinRate() {
    winRateHistory = [];
    document.getElementById('ai-win-rate-display').textContent = '50%';
    drawWinRateGraph(); // 그래프 초기화
}

/**
 * AI의 분석 점수와 게임 진행도를 기반으로 승률 UI를 업데이트합니다.
 * @param {number} score - AI가 판단한 현재 판의 점수
 * @param {number} moveCount - 현재까지 진행된 턴 수
 */
export function updateWinRate(score, moveCount) {
    // 게임 진행도에 따라 동적으로 스케일링 값을 조정
    const dynamicScale = 20000 - Math.min(Math.max(moveCount, 1) * 50, 8000);

    // 점수를 0-100% 범위의 확률로 변환 (Sigmoid 함수 활용)
    const winProbability = 1 / (1 + Math.exp(-score / dynamicScale));
    const winRate = Math.round(winProbability * 100);

    // 기록이 비어있으면(게임 첫 수 평가 시) 시작점인 50%를 추가
    if (winRateHistory.length === 0) {
        winRateHistory.push(50);
    }
    winRateHistory.push(winRate);

    // UI 업데이트
    const displayElement = document.getElementById('ai-win-rate-display');
    if (displayElement) displayElement.textContent = `${winRate}%`;
    
    // 그래프 다시 그리기
    drawWinRateGraph();
}


/**
 * 승률 기록을 바탕으로 캔버스에 그래프를 그립니다.
 */
function drawWinRateGraph() {
    const canvas = document.getElementById('win-rate-graph');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // 렌더링 크기에 맞춰 캔버스 해상도를 설정하여 선명하게 만듭니다.
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // 50% 기준선 그리기
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 2]); // 점선
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.setLineDash([]); // 점선 스타일 리셋

    if (winRateHistory.length < 2) return;

    // 승률 그래프 선 그리기
    ctx.beginPath();
    ctx.strokeStyle = '#337ab7';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const stepX = width / (winRateHistory.length - 1);

    winRateHistory.forEach((rate, index) => {
        const x = index * stepX;
        const y = height - (rate / 100) * height; // y좌표는 위에서부터 시작하므로 반전
        index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 그래프 아래 영역 채우기
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = 'rgba(51, 122, 183, 0.1)';
    ctx.fill();
}