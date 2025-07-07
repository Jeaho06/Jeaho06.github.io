// js/main.js
// --- 모듈 import ---
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth, logIn, logOut, signUp, getUserData } from './firebase.js';
import { createBoardUI, setStrings, updateAuthUI, updateProfilePopup } from './ui.js';
import { resetGame, setupBoardClickListener, initGameState } from './game.js';

// --- 애플리케이션 상태 관리 (main.js가 중앙에서 관리) ---
let currentUser = null;
let userData = null;
let guestData = { nickname: "Guest", stats: { wins: 0, losses: 0, draws: 0 } };

// --- 언어 로드 함수 ---
async function loadLanguage(lang) {
    try {
        const response = await fetch(`./lang/${lang}.json`);
        const strings = await response.json();
        setStrings(strings); // ui.js에 번역 전달
        document.documentElement.lang = lang;
        localStorage.setItem('omokLanguage', lang);
        // UI 텍스트 즉시 업데이트
        document.querySelectorAll('[data-i18n-key]').forEach(el => {
            const key = el.dataset.i18nKey;
            if (strings[key]) el.textContent = strings[key];
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.dataset.i18nPlaceholder;
            if (strings[key]) el.placeholder = strings[key];
        });
    } catch (error) { console.error("Language Error:", error); }
}

// --- 이벤트 리스너 설정 함수 ---
// js/main.js 파일의 setupEventListeners 함수를 아래 코드로 교체하세요.

function setupEventListeners() {
    // 새 게임 버튼
    document.getElementById('new-game-button').addEventListener('click', resetGame);
    
    // 보드 클릭 리스너
    setupBoardClickListener();

    // 팝업 공통 로직
    const overlay = document.getElementById('popup-overlay');
    const popups = document.querySelectorAll('.popup');
    const closeButtons = document.querySelectorAll('.popup-close-button');
    const closeAllPopups = () => {
        popups.forEach(p => p.style.display = 'none');
        overlay.style.display = 'none';
    };
    overlay.addEventListener('click', closeAllPopups);
    closeButtons.forEach(btn => btn.addEventListener('click', closeAllPopups));
    
    const showPopup = (id) => {
        document.getElementById(id).style.display = 'block';
        overlay.style.display = 'block';
    };

    // 개별 팝업 버튼
    document.getElementById('open-login-modal-btn').addEventListener('click', () => showPopup('auth-modal'));
    
    // [수정] 업데이트 버튼 클릭 시 내용 렌더링 함수를 호출하도록 변경
    document.getElementById('update-button').addEventListener('click', () => {
        setupUpdateHistory(); // 내용을 채우는 함수 호출
        showPopup('update-popup'); // 팝업 보이기
    });

    document.getElementById('profile-button').addEventListener('click', () => {
        updateProfilePopup(currentUser ? userData : guestData);
        showPopup('profile-popup');
    });

    // 인증 폼
    document.getElementById('show-signup').addEventListener('click', e => { e.preventDefault(); document.getElementById('login-form').style.display = 'none'; document.getElementById('signup-form').style.display = 'block'; });
    document.getElementById('show-login').addEventListener('click', e => { e.preventDefault(); document.getElementById('signup-form').style.display = 'none'; document.getElementById('login-form').style.display = 'block'; });
    document.getElementById('signup-btn').addEventListener('click', async () => {
        const result = await signUp(document.getElementById('signup-nickname').value, document.getElementById('signup-password').value);
        alert(result.message);
        if (result.success) closeAllPopups();
    });
    document.getElementById('login-btn').addEventListener('click', async () => {
        const result = await logIn(document.getElementById('login-nickname').value, document.getElementById('login-password').value);
        if (result.success) closeAllPopups(); else alert(result.message);
    });
    document.getElementById('logout-button').addEventListener('click', () => { logOut(); alert("로그아웃 되었습니다."); });
    
    // 언어 변경
    const langButton = document.getElementById('language-button');
    const langDropdown = document.getElementById('language-dropdown');
    langButton.addEventListener('click', e => { e.stopPropagation(); langDropdown.classList.toggle('show-dropdown'); });
    document.addEventListener('click', e => { if (!langButton.contains(e.target)) langDropdown.classList.remove('show-dropdown'); });
    langDropdown.addEventListener('click', async e => {
        if (e.target.tagName === 'A') {
            e.preventDefault();
            await loadLanguage(e.target.dataset.lang);
        }
    });
    
    // 피드백 위젯
    document.getElementById('feedback-toggle-btn').addEventListener('click', () => {
        document.getElementById('feedback-widget').classList.toggle('open');
    });
}

// --- 프로그램 시작점 ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. 언어 설정 먼저
    await loadLanguage(localStorage.getItem('omokLanguage') || 'ko');
    
    // 2. 인증 상태 리스너 설정
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            userData = await getUserData(user.uid);
            updateAuthUI(userData);
        } else {
            currentUser = null;
            userData = null;
            const savedGuest = localStorage.getItem('omok_guestData');
            guestData = savedGuest ? JSON.parse(savedGuest) : { nickname: "Guest", stats: { wins: 0, losses: 0, draws: 0 } };
            updateAuthUI(null);
        }
        // game.js에 현재 상태 전달
        initGameState(currentUser, userData, guestData);
    });

    // 3. 게임 시작
    resetGame();
    setupEventListeners();
});