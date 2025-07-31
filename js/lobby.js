// js/lobby.js
import { updateProfilePopup } from './ui.js';
import { getCurrentUser, getUserData, getGuestData, showPopup  } from './common.js';

/**
 * 로비 페이지에만 필요한 이벤트 리스너를 설정하는 함수
 */
export function initializeLobby() {
    // '게임 시작' 버튼 (로비 메인 화면)
    const startGameBtn = document.getElementById('start-game-btn');
    startGameBtn?.addEventListener('click', () => {
        // ▼▼▼ [수정 2] 기존 '게임 설정' 팝업 대신 '모드 선택' 팝업을 먼저 띄웁니다. ▼▼▼
        showPopup('game-mode-popup');
    });

    // 팝업 컨테이너에 이벤트 리스너 설정 (이벤트 위임)
    const popupContainer = document.getElementById('popups-placeholder');
    popupContainer?.addEventListener('click', (event) => {
        
        // --- '이 조건으로 시작' 버튼 로직 (일반전) ---
        if (event.target.id === 'confirm-start-game-btn') {
            event.stopPropagation();
            
            const selectedCheats = [];
            const popup = document.getElementById('game-settings-popup');
            popup?.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
                selectedCheats.push(checkbox.dataset.cheat);
            });
            const queryString = selectedCheats.map(cheat => `mode=${cheat}`).join('&');
            
            // 일반전이므로 type=normal 파라미터를 추가해줍니다.
            window.location.href = `game.html?type=normal&` + queryString;
        }

        // ▼▼▼ [수정 3] 새로 추가한 게임 모드 선택 버튼들의 로직 ▼▼▼

        // --- '베이직 모드' 버튼 ---
        if (event.target.id === 'select-mode-basic') {
            // 아무런 파라미터 없이 게임 페이지로 이동
            window.location.href = 'game.html';
        }

        // --- '일반전' 버튼 ---
        if (event.target.id === 'select-mode-normal') {
            // 기존의 '게임 설정' 팝업을 띄워 반칙을 선택하게 함
            showPopup('game-settings-popup');
        }

        // --- '경쟁전' 버튼 ---
        if (event.target.id === 'select-mode-ranked') {
            // AI가 사용할 수 있는 모든 반칙 목록
            const allCheats = ['veto', 'bomb', 'doubleMove', 'swap'];
            // 이 중에서 1개 또는 2개의 반칙을 무작위로 선택 (예시: 1개만 선택)
            const randomCheat = allCheats[Math.floor(Math.random() * allCheats.length)];
            
            // 선택된 반칙과 'ranked' 타입을 파라미터로 하여 게임 페이지로 이동
            window.location.href = `game.html?mode=${randomCheat}&type=ranked`;
        }
    });

    // 프로필 버튼 로직 (기존과 동일)
    const profileButton = document.getElementById('lobby-profile-button');
    profileButton?.addEventListener('click', () => {
        const currentUser = getCurrentUser();
        const userData = getUserData();
        const guestData = getGuestData();
        
        updateProfilePopup(currentUser ? userData : guestData);
        showPopup('profile-popup');
    });
}