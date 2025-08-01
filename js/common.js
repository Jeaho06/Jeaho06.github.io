// js/common.js

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, logOut, signUp, logIn } from './firebase.js';
import { updatePlayerInfoBox, setStrings, updateProfilePopup, updateAuthUI, updateLevelUI, getCurrentStrings, updateLobbySidebar } from './ui.js';
import { loadComponents } from './componentLoader.js';
import { loadGuestData } from './guestManager.js';
import { initializeAudioManager, playSfx, setBgmVolume, setSfxVolume, getBgmVolume, getSfxVolume } from './audioManager.js';
import { setupShop } from './shop.js';
import { setupInventory } from './inventory.js';
import { initializeEffectSettings } from './effectController.js'; 

// --- 전역 변수 ---
let currentUser = null;
let userData = null;
let guestData = null;

export const getCurrentUser = () => currentUser;
export const getUserData = () => userData;
export const getGuestData = () => guestData;


// ▼▼▼ [수정 1] 팝업 관련 함수를 밖으로 꺼내고, showPopup을 export 합니다. ▼▼▼

/**
 * 지정된 ID의 팝업을 화면에 보여줍니다.
 * @param {string} id - 보여줄 팝업의 ID
 */
export function showPopup(id) {
    const overlay = document.getElementById('popup-overlay');
    const popup = document.getElementById(id);

    // 다른 팝업이 열려있을 수 있으므로, 일단 모두 닫고 시작합니다.
    closeAllPopups();

    if (overlay) overlay.style.display = 'block';
    if (popup) popup.style.display = 'block';
}

/**
 * 화면에 열려있는 모든 팝업을 닫습니다.
 */
export function closeAllPopups() {
    const overlay = document.getElementById('popup-overlay');
    const popups = document.querySelectorAll('.popup');
    
    if (overlay) overlay.style.display = 'none';
    popups.forEach(p => { if (p) p.style.display = 'none'; });
}

// ▲▲▲ 여기까지 수정 ▲▲▲
// --- 공용 기능 함수 ---

// ▼▼▼ [수정 1] 여기에 setupClickSounds 함수를 추가합니다. ▼▼▼
/** 모든 버튼에 클릭 사운드를 추가하는 함수 */
function setupClickSounds() {
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('mousedown', () => playSfx('click'));
    });
}

/** 공용 팝업 및 UI 컨트롤 이벤트를 설정하는 함수 */
function setupCommonControls() {
    const overlay = document.getElementById('popup-overlay');
    const popups = document.querySelectorAll('.popup');
    const closeButtons = document.querySelectorAll('.popup-close-button');

    const closeAllPopups = () => {
        popups.forEach(p => { if(p) p.style.display = 'none' });
        if (overlay) overlay.style.display = 'none';
    };

    const showPopup = (id) => {
        closeAllPopups();
        const popup = document.getElementById(id);
        if (popup) popup.style.display = 'block';
        if (overlay) overlay.style.display = 'block';
    };

    overlay?.addEventListener('click', closeAllPopups);
    closeButtons.forEach(btn => btn.addEventListener('click', closeAllPopups));

    const settingsButton = document.createElement('button');
    settingsButton.id = 'settings-button';
    settingsButton.dataset.i18nKey = 'settings_btn'; 
    settingsButton.textContent = '설정';
    const globalControls = document.querySelector('.global-controls');
    if (globalControls) {
        globalControls.appendChild(settingsButton);
    }
    settingsButton.addEventListener('click', () => {
        updateSettingsPopup();
        showPopup('settings-popup');
    });

    const bgmSlider = document.getElementById('bgm-volume-slider');
    const sfxSlider = document.getElementById('sfx-volume-slider');

    bgmSlider?.addEventListener('input', (e) => {
        setBgmVolume(parseFloat(e.target.value));
        updateSettingsPopup();
    });
    sfxSlider?.addEventListener('input', (e) => {
        setSfxVolume(parseFloat(e.target.value));
        updateSettingsPopup();
    });

    document.getElementById('profile-button')?.addEventListener('click', () => {
        updateProfilePopup(currentUser ? userData : guestData);
        showPopup('profile-popup');
    });
    document.getElementById('open-login-modal-btn')?.addEventListener('click', () => showPopup('auth-modal'));
    
    const updateButtonHandler = () => {
        renderNewsContent();
        showPopup('update-popup');
    };
    document.getElementById('update-button')?.addEventListener('click', updateButtonHandler);
    document.getElementById('lobby-update-button')?.addEventListener('click', updateButtonHandler);
    
    const langButton = document.getElementById('language-button');
    const langDropdown = document.createElement('div');
    langDropdown.className = 'dropdown-content';
    langDropdown.innerHTML = `<a href="#" data-lang="ko">한국어</a><a href="#" data-lang="en">English</a><a href="#" data-lang="ja">日本語</a>`;
    langButton?.parentNode.appendChild(langDropdown);
    langButton?.addEventListener('click', (e) => {
        e.stopPropagation();
        langDropdown.classList.toggle('show-dropdown');
    });
    langDropdown.addEventListener('click', async (e) => {
        if (e.target.tagName === 'A') {
            await loadLanguage(e.target.dataset.lang);
            langDropdown.classList.remove('show-dropdown');
        }
    });
    document.body.addEventListener('click', () => {
        if (langDropdown.classList.contains('show-dropdown')) {
            langDropdown.classList.remove('show-dropdown');
        }
    });

    document.getElementById('show-signup')?.addEventListener('click', e => { e.preventDefault(); document.getElementById('login-form').style.display = 'none'; document.getElementById('signup-form').style.display = 'block'; });
    document.getElementById('show-login')?.addEventListener('click', e => { e.preventDefault(); document.getElementById('signup-form').style.display = 'none'; document.getElementById('login-form').style.display = 'block'; });
    
    document.getElementById('login-btn')?.addEventListener('click', async () => {
        const nickname = document.getElementById('login-nickname').value;
        const password = document.getElementById('login-password').value;
        const result = await logIn(nickname, password);
        alert(result.message);
        if (result.success) closeAllPopups();
    });

    document.getElementById('signup-btn')?.addEventListener('click', async () => {
        const nickname = document.getElementById('signup-nickname').value;
        const password = document.getElementById('signup-password').value;
        const result = await signUp(nickname, password);
        alert(result.message);
        if (result.success) closeAllPopups();
    });

}

/** 설정 팝업의 UI를 현재 볼륨 값에 맞게 업데이트하는 함수 */
function updateSettingsPopup() {
    const bgmSlider = document.getElementById('bgm-volume-slider');
    const bgmValueText = document.getElementById('bgm-volume-value');
    const bgmIcon = document.getElementById('bgm-volume-icon');
    const sfxSlider = document.getElementById('sfx-volume-slider');
    const sfxValueText = document.getElementById('sfx-volume-value');
    const sfxIcon = document.getElementById('sfx-volume-icon');

    if (!bgmSlider) return;

    const bgmVolume = getBgmVolume();
    const sfxVolume = getSfxVolume();

    bgmSlider.value = bgmVolume;
    bgmValueText.textContent = `${Math.round(bgmVolume * 100)}%`;
    bgmIcon.textContent = bgmVolume > 0 ? '🔊' : '🔇';

    sfxSlider.value = sfxVolume;
    sfxValueText.textContent = `${Math.round(sfxVolume * 100)}%`;
    sfxIcon.textContent = sfxVolume > 0 ? '🔊' : '🔇';
}

function renderNewsContent() {
    const updatePopup = document.getElementById('update-popup');
    const newsContent = document.getElementById('news-content');
    const mailContent = document.getElementById('mail-content');
    const mailButton = document.getElementById('mail-button');
    const newsButton = document.getElementById('news-button');

    if (!newsContent || !updatePopup || !mailContent || !mailButton || !newsButton) return;

    newsContent.style.height = 'calc(100% - 100px)';
    newsContent.style.overflowY = 'auto';

    const showTab = (tabName) => {
        mailButton.classList.toggle('active', tabName === 'mail');
        newsButton.classList.toggle('active', tabName === 'news');
        mailContent.style.display = tabName === 'mail' ? 'block' : 'none';
        newsContent.style.display = tabName === 'news' ? 'block' : 'none';
    };

    mailButton.addEventListener('click', () => showTab('mail'));
    newsButton.addEventListener('click', () => showTab('news'));

    newsContent.innerHTML = '';
    const updateLogs = getCurrentStrings().update_logs || [];
    updateLogs.forEach(log => {
        const newsItem = document.createElement('div');
        newsItem.classList.add('news-item');
        newsItem.textContent = `Version ${log.version}: ${log.date}`;
        newsItem.addEventListener('click', () => showNewsDetails(log));
        newsContent.appendChild(newsItem);
    });
    
    showTab('mail'); 
}

/** 뉴스 상세 팝업을 보여주는 함수 */
function showNewsDetails(log) {
    const newsPopup = document.getElementById('news-popup');
    const updatePopup = document.getElementById('update-popup');
    if (!newsPopup || !updatePopup) return;

    newsPopup.innerHTML = `<h2>Version ${log.version}: ${log.date}</h2><ul>${log.notes.map(note => `<li>${note}</li>`).join('')}</ul><button class="popup-close-button">닫기</button>`;
    
    updatePopup.style.display = 'none';
    newsPopup.style.display = 'block';

    const newCloseButton = newsPopup.querySelector('.popup-close-button');

    // ▼▼▼ [수정 2] new Audio() 대신 playSfx()를 사용합니다. ▼▼▼
    newCloseButton.addEventListener('mousedown', () => playSfx('click'));
    
    newCloseButton.addEventListener('click', () => {
        newsPopup.style.display = 'none';
        updatePopup.style.display = 'block';
    });
}

async function loadLanguage(lang) {
    try {
        const response = await fetch(`/lang/${lang}.json`);
        const strings = await response.json();
        setStrings(strings);
        document.documentElement.lang = lang;
        localStorage.setItem('omokLanguage', lang);
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

// js/common.js

/**
 * [최종 수정] 앱 전체의 초기화 순서를 책임지는 함수.
 * 컴포넌트 로딩 -> 언어 적용 -> 공용 컨트롤 설정 -> 인증 확인 순서를 보장합니다.
 */
export function initializeApp() {
    // Promise를 반환하여, 모든 비동기 초기화가 끝날 때까지 앱 실행을 대기시킵니다.
    return new Promise(async (resolve) => {
        
        // 1. HTML 컴포넌트(popups.html 등)를 먼저 로드하여 DOM에 삽입합니다.
        await loadComponents();

        // 2. 삽입된 컴포넌트를 포함하여 페이지 전체의 언어를 적용합니다.
        await loadLanguage(localStorage.getItem('omokLanguage') || 'ko');

        // 3. 이제 모든 HTML 요소가 준비되었으므로, 공용 컨트롤과 이벤트 리스너를 설정합니다.
        initializeAudioManager();
        initializeEffectSettings();
        setupCommonControls();
        setupClickSounds();
        setupShop();
        setupInventory();
        
        // 4. 마지막으로 사용자 인증 상태를 확인합니다.
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // 로그인 사용자
                const userRef = doc(db, "users", user.uid);
                onSnapshot(userRef, (docSnap) => {
                    if (docSnap.exists()) {
                        currentUser = user;
                        userData = docSnap.data();
                        updateAuthUI(userData);
                        updateLevelUI(userData);
                        updateLobbySidebar(userData);
                        if (document.getElementById('game-board')) {
                            updatePlayerInfoBox(userData);
                        }
                        // 모든 설정이 끝났으므로 Promise를 이행(resolve)하여 대기를 해제합니다.
                        resolve();
                    } else {
                        logOut(); 
                        resolve();
                    }
                });
            } else {
                // 게스트 사용자
                currentUser = null;
                userData = null;
                guestData = loadGuestData();
                updateAuthUI(null, guestData);
                updateLevelUI(guestData);
                updateLobbySidebar(guestData);
                if (document.getElementById('game-board')) {
                    updatePlayerInfoBox(guestData);
                }
                // 모든 설정이 끝났으므로 Promise를 이행(resolve)하여 대기를 해제합니다.
                resolve();
            }
        });
    });
}