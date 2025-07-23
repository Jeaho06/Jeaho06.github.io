// js/main.js
// --- 모듈 import ---
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"; // doc, onSnapshot을 firestore에서 가져옵니다.
import { auth, logIn, logOut, signUp, getUserData, db } from './firebase.js';
import { createBoardUI, setStrings, updateAuthUI, updateProfilePopup, getCurrentStrings, updateLevelUI } from './ui.js';
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
            if (strings[key]) el.innerHTML = strings[key];
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.dataset.i18nPlaceholder;
            if (strings[key]) el.placeholder = strings[key];
        });
    } catch (error) { console.error("Language Error:", error); }
}

// --- 이벤트 리스너 설정 함수 --

// ...

// js/main.js 파일의 setupEventListeners 함수를 아래 코드로 교체하세요.

function setupEventListeners() {
    // 새 게임 버튼
    document.getElementById('new-game-button').addEventListener('click', resetGame);
    
    // 보드 클릭 리스너
    setupBoardClickListener();

    // --- 팝업 공통 로직 ---
    const overlay = document.getElementById('popup-overlay');
    const popups = document.querySelectorAll('.popup');
    const closeButtons = document.querySelectorAll('.popup-close-button');
    const closeAllPopups = () => {
        popups.forEach(p => p.style.display = 'none');
        document.getElementById('news-popup').style.display = 'none'; // [수정] 뉴스 팝업도 닫기
        overlay.style.display = 'none';
    };
    overlay.addEventListener('click', closeAllPopups);
    closeButtons.forEach(btn => btn.addEventListener('click', closeAllPopups));
    
    const showPopup = (id) => {
        document.getElementById(id).style.display = 'block';
        overlay.style.display = 'block';
    };

    // 1. 업데이트 팝업
    const updateButton = document.getElementById('update-button');    
    updateButton.addEventListener('click', () => { 
        renderNewsContent(); 
        showPopup('update-popup'); 
    });

    // 2. 탭 기능
    const mailButton = document.getElementById('mail-button'), newsButton = document.getElementById('news-button');
    const mailContent = document.getElementById('mail-content'), newsContent = document.getElementById('news-content');
    const showTab = (tabName) => { // [수정] 탭 내용 전환
        mailButton.classList.toggle('active', tabName === 'mail'); // 버튼 활성/비활성 상태 변경
        newsButton.classList.toggle('active', tabName === 'news');
        mailContent.style.display = tabName === 'mail' ? 'block' : 'none'; // 내용 표시/숨김
        newsContent.style.display = tabName === 'news' ? 'block' : 'none';
    };
    showTab('mail'); // 초기 탭 설정
    mailButton.addEventListener('click', () => showTab('mail'));
    newsButton.addEventListener('click', () => showTab('news'));

    // 3. 팝업 외부 영역 클릭 시 팝업 닫힘 (news-popup 추가)
    overlay.addEventListener('click', () => { closeAllPopups(); });

    // 뉴스 탭 내용 동적 생성
    const renderNewsContent = () => {
        newsContent.innerHTML = ''; // 기존 내용 초기화
        const updateLogs = getCurrentStrings().update_logs || [];
        updateLogs.forEach(log => {
            const newsItem = document.createElement('div');
            newsItem.classList.add('news-item');
            newsItem.textContent = `Version ${log.version}: ${log.date}`;
            
            // 3. 패치 노트 클릭 시 새 팝업 표시
            newsItem.addEventListener('click', () => {
                showNewsPopup(log); // [수정] showNewsPopup 호출
            });
            newsContent.appendChild(newsItem);
        });
    };

    // [추가] 뉴스 팝업 표시 함수
    const showNewsPopup = (log) => {
        const newsPopup = document.getElementById('news-popup');
        newsPopup.innerHTML = `<h2>Version ${log.version}: ${log.date}</h2><ul>${log.notes.map(note => `<li>${note}</li>`).join('')}</ul><button class="popup-close-button" onclick="document.getElementById('news-popup').style.display = 'none'; document.getElementById('update-popup').style.display = 'block';">닫기</button>`;
        document.getElementById('update-popup').style.display = 'none'; // 기존 팝업 숨김
        newsPopup.style.display = 'block'; // 새 팝업 표시
    };

    // 2. 나머지 팝업 버튼들 (변경 없음)
    document.getElementById('open-login-modal-btn').addEventListener('click', () => showPopup('auth-modal'));
    document.getElementById('profile-button').addEventListener('click', () => {
        updateProfilePopup(currentUser ? userData : guestData);
        showPopup('profile-popup');
    });

    // --- 나머지 컨트롤러 로직 (수정 없음) ---
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

    document.getElementById('feedback-toggle-btn').addEventListener('click', () => {
        document.getElementById('feedback-widget').classList.toggle('open');
    });
}

// [추가] 효과음 재생 함수
const playClickSound = () => {
    new Audio('sounds/Click.mp3').play();
};

// --- 프로그램 시작점 ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. 언어 설정 먼저
    await loadLanguage(localStorage.getItem('omokLanguage') || 'ko');

    // 2. 인증 상태 리스너 설정
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // [수정] 기존의 일회성 데이터 로드를 실시간 리스너(onSnapshot)로 변경
            const userRef = doc(db, "users", user.uid);
            onSnapshot(userRef, (docSnap) => {
                if (docSnap.exists()) {
                    currentUser = user;
                    userData = docSnap.data();
                    userData.uid = user.uid; // 편의를 위해 uid 추가

                    // UI 업데이트
                    updateAuthUI(userData);
                    updateLevelUI(userData); // [핵심] 레벨 바 UI 실시간 업데이트

                    // game.js에 상태 전달
                    initGameState(currentUser, userData, guestData);
                } else {
                    // 문서가 없는 예외적인 경우 (예: DB에서 직접 삭제)
                    logOut();
                }
            });
        } else {
            currentUser = null;
            userData = null;
            const savedGuest = localStorage.getItem('omok_guestData');
            guestData = savedGuest ? JSON.parse(savedGuest) : { nickname: "Guest", stats: { wins: 0, losses: 0, draws: 0 } };

            // 로그아웃 시 UI 업데이트
            updateAuthUI(null);
            updateLevelUI(null); // 레벨 바 숨기기

            // game.js에 상태 전달
            initGameState(currentUser, userData, guestData);
        }
    });

    // 3. 게임 시작
    resetGame();
    setupEventListeners();

    // [추가] 모든 버튼에 클릭 이벤트 추가 (토글 제외, footer 제외, 오목판 제외)
    document.querySelectorAll('button:not(.slider):not(#game-board button)').forEach(button => {
        button.addEventListener('mousedown', playClickSound);
    });
});