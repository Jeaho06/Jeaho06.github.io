// js/guestManager.js
import { getRequiredXpForLevel } from './firebase.js';
const GUEST_DATA_KEY = 'omok_guestData';

const REWARD_TABLE = {
    veto: { xp: 5, luna: 2 },
    bomb: { xp: 10, luna: 5 },
    doubleMove: { xp: 15, luna: 8 },
    swap: { xp: 20, luna: 10 }
};
/**
 * localStorage에서 게스트 데이터를 불러옵니다.
 * @returns {object} 게스트 데이터
 */
export function loadGuestData() {
    const data = JSON.parse(localStorage.getItem(GUEST_DATA_KEY));
    // 데이터가 없거나 오래된 형식일 경우, 새로운 기본값으로 초기화
    if (!data || !data.stats || !data.hasOwnProperty('level')) {
        return {
            nickname: "Guest",
            stats: { wins: 0, losses: 0, draws: 0 },
            stats_by_cheat: {},
            level: 1,
            experience: 0,
            luna: 100,
            lastWinTimestamp: null
        };
    }
    return data;
}

/**
 * 게스트 데이터를 localStorage에 저장합니다.
 * @param {object} data - 저장할 게스트 데이터
 */
function saveGuestData(data) {
    localStorage.setItem(GUEST_DATA_KEY, JSON.stringify(data));
}

/**
 * 게스트의 게임 결과를 계산하고 저장합니다. (firebase.js의 로직을 기반으로 함)
 * @param {'win' | 'loss' | 'draw'} gameResult - 게임 결과
 * @param {number} moveCount - 총 착수 횟수
 * @param {object} activeCheats - 활성화된 반칙 목록
 * @returns {object} 업데이트 결과 (획득 경험치, 레벨업 여부 등)
 */
export function updateGuestGameResult(gameResult, moveCount, activeCheats = {}) {
    const XP_TABLE = { win: 50, loss: 10, draw: 20 };
    const LUNA_TABLE = { win: 20, loss: 5, draw: 10 };
    const DAILY_BONUS = 100;
    const XP_PER_MOVE_CAP = 15;

    let guestData = loadGuestData();

    // 1. 전적 업데이트
    if (gameResult === 'win') guestData.stats.wins++;
    else if (gameResult === 'loss') guestData.stats.losses++;
    else if (gameResult === 'draw') guestData.stats.draws++;

    // 2. 반칙별 전적 업데이트
    if (gameResult === 'win' || gameResult === 'loss') {
        for (const cheat in activeCheats) {
            if (activeCheats[cheat]) {
                if (!guestData.stats_by_cheat[cheat]) {
                    guestData.stats_by_cheat[cheat] = { wins: 0, losses: 0 };
                }
                if (gameResult === 'win') guestData.stats_by_cheat[cheat].wins++;
                else guestData.stats_by_cheat[cheat].losses++;
            }
        }
    }
    
    // 3. 경험치 및 루나 계산
    let xpGained = XP_TABLE[gameResult];
    xpGained += Math.min(moveCount, XP_PER_MOVE_CAP);

    let lunaGained = LUNA_TABLE[gameResult];

    let bonusXp = 0;
    let bonusLuna = 0;
    let didGetDailyBonus = false;

    if (gameResult === 'win') {
        // 반칙 보너스
        for (const cheat in activeCheats) {
            if (activeCheats[cheat] && REWARD_TABLE[cheat]) {
                bonusXp += REWARD_TABLE[cheat].xp;
                bonusLuna += REWARD_TABLE[cheat].luna;
            }
        }
        // 일일 첫 승 보너스
        const now = new Date();
        const lastWin = guestData.lastWinTimestamp ? new Date(guestData.lastWinTimestamp) : null;
        if (!lastWin || lastWin.toDateString() !== now.toDateString()) {
            xpGained += DAILY_BONUS;
            didGetDailyBonus = true;
            guestData.lastWinTimestamp = now.toISOString();
        }
    }
    xpGained += bonusXp;
    lunaGained += bonusLuna;
    
    guestData.experience += xpGained;
    guestData.luna += lunaGained;

    // 4. 레벨업 계산
    let didLevelUp = false;
    let requiredXp = getRequiredXpForLevel(guestData.level);
    while (guestData.experience >= requiredXp) {
        guestData.level++;
        guestData.experience -= requiredXp;
        requiredXp = getRequiredXpForLevel(guestData.level);
        didLevelUp = true;
    }
    
    // 5. 변경된 데이터 저장
    saveGuestData(guestData);

    // 6. 결과 반환
    return {
        xpGained, didLevelUp, newLevel: guestData.level, didGetDailyBonus,
        lunaGained, bonusXp, bonusLuna
    };
}

// js/guestManager.js 파일 맨 아래에 추가

/**
 * 게스트 사용자의 아이템 구매를 처리합니다. (localStorage 사용)
 * @param {string} itemId - 구매할 아이템의 ID
 * @param {number} itemPrice - 아이템 가격
 * @returns {{success: boolean, message: string}} - 처리 결과
 */
export function purchaseItemForGuest(itemId, itemPrice) {
    const guestData = loadGuestData();

    // 보유 아이템 목록이 없으면 초기화
    if (!guestData.ownedItems) {
        guestData.ownedItems = [];
    }

    // 이미 보유했는지 확인
    if (guestData.ownedItems.includes(itemId)) {
        return { success: false, message: '이미 보유하고 있는 아이템입니다.' };
    }

    // 루나가 충분한지 확인
    if (guestData.luna < itemPrice) {
        return { success: false, message: '루나가 부족합니다.' };
    }

    // 루나 차감 및 아이템 추가
    guestData.luna -= itemPrice;
    guestData.ownedItems.push(itemId);

    // 변경된 데이터를 localStorage에 저장
    saveGuestData(guestData);

    return { success: true, message: '구매에 성공했습니다!' };
}

/**
 * 게스트의 장착 아이템 정보를 localStorage에 업데이트합니다.
 * [수정] 처리 결과를 문자열로 반환합니다.
 * @param {object} itemToEquip - 장착할 아이템 객체
 * @returns {string} 'equipped' 또는 'unequipped'
 */
export function updateEquippedItemForGuest(itemToEquip) {
    const guestData = loadGuestData();
    let action = 'equipped';

    if (!guestData.equippedItems) {
        guestData.equippedItems = {};
    }

    // 이미 같은 아이템이 장착되어 있으면 장착 해제, 아니면 장착
    if (guestData.equippedItems[itemToEquip.type] === itemToEquip.id) {
        delete guestData.equippedItems[itemToEquip.type];
        action = 'unequipped';
    } else {
        guestData.equippedItems[itemToEquip.type] = itemToEquip.id;
    }

    saveGuestData(guestData);
    return action; // 수행한 동작을 반환
}

// js/guestManager.js 파일 맨 아래에 추가

/**
 * [개발자용] 게스트의 보유 및 장착 아이템 정보를 초기화합니다.
 */
export function resetGuestItems() {
    try {
        const guestData = loadGuestData();
        
        guestData.ownedItems = []; // 보유 아이템 목록을 빈 배열로 초기화
        guestData.equippedItems = {}; // 장착 아이템 정보를 빈 객체로 초기화
        
        saveGuestData(guestData);
        
        console.log('✅ 게스트 아이템 정보가 성공적으로 초기화되었습니다. 페이지를 새로고침하여 확인하세요.');
        // 콘솔에서 실행 결과를 쉽게 확인하기 위해 문자열을 반환합니다.
        return '게스트 아이템 초기화 완료.'; 
    } catch (error) {
        console.error('게스트 아이템 초기화 중 오류 발생:', error);
        return '게스트 아이템 초기화 실패.';
    }
}