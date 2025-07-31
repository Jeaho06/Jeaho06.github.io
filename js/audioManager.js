// js/audioManager.js

// --- 기본 설정 ---
const BGM_SRC = 'sounds/SummerGoes.wav'; 
const CLICK_SOUND_SRC = 'sounds/Click.mp3'; //
const MOVE_SOUND_SRC = 'sounds/Movement.mp3'; //
const EXPLOSION_SOUND_SRC = 'sounds/tnt_explosion.mp3'; //
const START_SOUND_SRC = 'sounds/start.mp3'; // <<< 게임 시작음 경로 추가
const INSTALL_SOUND_SRC = 'sounds/tnt_installation.mp3'; // <<< 폭탄 설치음 경로 추가
const LEVELUP_SOUND_SRC = 'sounds/levelup.mp3'; // <<< 레벨업음 경로 추가
const CLOSED_FOUR_SOUND_SRC = 'sounds/closed_four.mp3';
const WIN_SPECIAL_SOUND_SRC = 'sounds/win_special.mp3';
// --- HTML 요소 ---
let bgmElement;

// --- 상태 관리 ---
let bgmVolume = 1.0;
let sfxVolume = 1.0;

/**
 * 오디오 매니저를 초기화하는 메인 함수
 */
export function initializeAudioManager() {
    // 1. localStorage에서 저장된 볼륨 설정을 불러옵니다.
    loadVolumeSettings();

    // 2. BGM용 <audio> 태그를 생성하고 설정합니다.
    setupBgmElement();

    // 3. 첫 사용자 상호작용 시 BGM을 재생하는 이벤트를 설정합니다.
    setupBgmPlaybackTrigger();
}

/**
 * localStorage에서 볼륨 설정을 불러와 변수에 저장합니다.
 */
function loadVolumeSettings() {
    const savedBgmVolume = localStorage.getItem('bgmVolume');
    const savedSfxVolume = localStorage.getItem('sfxVolume');

    // 저장된 값이 있으면 사용하고, 없으면 기본값(1.0)을 사용합니다.
    bgmVolume = savedBgmVolume !== null ? parseFloat(savedBgmVolume) : 1.0;
    sfxVolume = savedSfxVolume !== null ? parseFloat(savedSfxVolume) : 1.0;
}

/**
 * BGM 재생을 위한 <audio> 요소를 동적으로 생성하여 body에 추가합니다.
 */
function setupBgmElement() {
    bgmElement = document.createElement('audio');
    bgmElement.id = 'bgm-player';
    bgmElement.src = BGM_SRC;
    bgmElement.loop = true;
    bgmElement.volume = bgmVolume; // 저장된 볼륨으로 초기 설정
    document.body.appendChild(bgmElement);
}

/**
 * 페이지 첫 클릭 시 BGM을 재생하도록 설정합니다.
 */
function setupBgmPlaybackTrigger() {
    document.addEventListener('click', () => {
        if (bgmElement.paused) {
            bgmElement.play().catch(error => {
                console.error("BGM 자동 재생 실패:", error);
            });
        }
    }, { once: true });
}

/**
 * BGM 볼륨을 조절하는 함수
 * @param {number} volume - 0.0 ~ 1.0 사이의 볼륨 값
 */
export function setBgmVolume(volume) {
    bgmVolume = volume;
    if (bgmElement) {
        bgmElement.volume = bgmVolume;
    }
    localStorage.setItem('bgmVolume', bgmVolume);
}

/**
 * 효과음(SFX) 볼륨을 조절하는 함수
 * @param {number} volume - 0.0 ~ 1.0 사이의 볼륨 값
 */
export function setSfxVolume(volume) {
    sfxVolume = volume;
    localStorage.setItem('sfxVolume', sfxVolume);
}

/**
 * 효과음을 재생하는 공용 함수
 * @param {'click' | 'move' | 'explosion' | 'start' | 'install' | 'levelup'} soundType - 재생할 소리 종류
 */
export function playSfx(soundType) {
    let src;
    switch (soundType) {
        case 'click':
            src = CLICK_SOUND_SRC;
            break;
        case 'move':
            src = MOVE_SOUND_SRC;
            break;
        case 'explosion':
            src = EXPLOSION_SOUND_SRC;
            break;
        case 'start': // <<< start 케이스 추가
            src = START_SOUND_SRC;
            break;
        case 'install': // <<< install 케이스 추가
            src = INSTALL_SOUND_SRC;
            break;
        case 'levelup': // <<< levelup 케이스 추가
            src = LEVELUP_SOUND_SRC;
            break;
        case 'closed_four':
            src = CLOSED_FOUR_SOUND_SRC;
            break;
        case 'win_special':
            src = WIN_SPECIAL_SOUND_SRC;
            break;
        default:
            return;
    }

    const audio = new Audio(src);
    audio.volume = sfxVolume;
    audio.play();
}
// 설정 팝업에서 현재 볼륨 값을 가져가기 위한 getter 함수
export const getBgmVolume = () => bgmVolume;
export const getSfxVolume = () => sfxVolume;