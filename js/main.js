// js/main.js
import { resetGame, setupBoardClickListener } from './game.js';

// 현재 게임의 설정을 저장할 변수를 파일 상단에 추가합니다.
let lastSettings = { cheats: [] };

/**
 * 게임 페이지에 필요한 모든 초기화 로직을 담는 함수
 * [수정] '새 게임' 버튼을 '포기하기' 버튼으로 변경하고 로비로 이동하는 기능을 추가합니다.
 */
export function initializeGamePage() {
    // URL에서 게임 모드 설정 값 읽어오기
    const urlParams = new URLSearchParams(window.location.search);
    const selectedModes = urlParams.getAll('mode');
    
    // 현재 게임의 설정을 lastSettings에 저장합니다.
    const lastSettings = { cheats: selectedModes };
    
    // 게임 시작 및 보드 설정
    resetGame(lastSettings);
    setupBoardClickListener();

    // '포기하기' 버튼 이벤트 리스너
    const giveUpButton = document.getElementById('give-up-button');
    giveUpButton?.addEventListener('click', () => {
        // 확인 창을 띄워 사용자의 의사를 한 번 더 묻습니다.
        if (confirm('정말 포기하고 로비로 돌아가시겠습니까?')) {
            window.location.href = '/index.html'; // 로비 페이지로 이동
        }
    });
}