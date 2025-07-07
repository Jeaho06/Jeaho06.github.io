// js/main.js
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth, logIn, logOut, signUp, getUserData } from './firebase.js';
import { setStrings, updateAuthUI, updateProfilePopup } from './ui.js';
import { resetGame, setupBoardClickListener, initGameState } from './game.js';

async function loadLanguage(lang) {
    try {
        const response = await fetch(`./lang/${lang}.json`);
        const strings = await response.json();
        setStrings(strings);
        document.documentElement.lang = lang;
        localStorage.setItem('omokLanguage', lang);
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

function setupEventListeners() {
    setupBoardClickListener();
    document.getElementById('new-game-button').addEventListener('click', resetGame);

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

    document.getElementById('open-login-modal-btn').addEventListener('click', () => showPopup('auth-modal'));
    document.getElementById('update-button').addEventListener('click', () => showPopup('update-popup'));
    document.getElementById('profile-button').addEventListener('click', () => {
        updateProfilePopup();
        showPopup('profile-popup');
    });
    
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


document.addEventListener('DOMContentLoaded', async () => {
    await loadLanguage(localStorage.getItem('omokLanguage') || 'ko');
    
    onAuthStateChanged(auth, async (user) => {
        let currentUser = null, userData = null;
        let guestData = { nickname: "Guest", stats: { wins: 0, losses: 0, draws: 0 } };

        if (user) {
            currentUser = user;
            userData = await getUserData(user.uid);
            updateAuthUI(userData);
        } else {
            const savedGuest = localStorage.getItem('omok_guestData');
            guestData = savedGuest ? JSON.parse(savedGuest) : guestData;
            updateAuthUI(null);
        }
        initGameState(currentUser, userData, guestData);
    });

    initGameState(null, null, { nickname: "Guest", stats: { wins: 0, losses: 0, draws: 0 } });
    resetGame();
    setupEventListeners();
});