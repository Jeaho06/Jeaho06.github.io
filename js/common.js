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
function closeAllPopups() {
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

/**
 * [수정됨] 앱 초기화 함수
 * 이제 Promise를 반환하여, 첫 인증 상태가 확인될 때까지 기다릴 수 있습니다.
 */
export function initializeApp() {
    // 인증과 무관하게 먼저 실행해도 되는 초기화 작업들
    initializeAudioManager();
    initializeEffectSettings();

    // Promise를 반환하여 호출한 쪽(game.html)에서 로딩을 기다리게 함
    return new Promise(async (resolve) => {
        // 1. 언어팩과 공용 HTML(팝업 등) 로딩을 먼저 완료
        await loadLanguage(localStorage.getItem('omokLanguage') || 'ko');
        await loadComponents();

        // 2. 로드된 HTML 요소에 이벤트 핸들러 설정
        setupCommonControls();
        setupClickSounds();
        setupShop();
        setupInventory();
        
        // 3. 인증 상태 리스너 설정. 첫 실행 시 Promise를 resolve()하여 대기 해제
        // onAuthStateChanged는 사용자가 로그인하거나 로그아웃할 때마다 호출됩니다.
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // 로그인 사용자: Firestore에서 실시간 데이터 수신
                const userRef = doc(db, "users", user.uid);
                onSnapshot(userRef, (docSnap) => {
                    if (docSnap.exists()) {
                        currentUser = user;
                        userData = docSnap.data();
                        
                        // 모든 관련 UI 업데이트
                        updateAuthUI(userData);
                        updateLevelUI(userData);
                        updateLobbySidebar(userData);
                        
                        // 게임 페이지에만 있는 UI 요소는 존재 여부 확인 후 업데이트
                        if (document.getElementById('game-board')) {
                            updatePlayerInfoBox(userData);
                        }
                        
                        // 사용자 정보 로딩 및 UI 업데이트가 완료되었으므로,
                        // Promise를 이행(resolve)하여 앱의 나머지 부분이 실행되도록 합니다.
                        resolve();
                    } else {
                        // 인증은 됐으나 DB에 유저 정보가 없는 경우 (오류 상황)
                        logOut(); // 안전을 위해 로그아웃 처리
                        resolve(); // 다음으로 진행하기 위해 이행은 필수
                    }
                });
            } else {
                // 게스트 사용자
                currentUser = null;
                userData = null;
                guestData = loadGuestData();
                
                // 게스트용 UI 업데이트
                updateAuthUI(null, guestData);
                updateLevelUI(guestData);
                updateLobbySidebar(guestData);
                if (document.getElementById('game-board')) {
                    updatePlayerInfoBox(guestData);
                }
                
                // 게스트 정보 로딩이 완료되었으므로, Promise를 이행합니다.
                resolve();
            }
        });
    });
}