// js/skinManager.js

import { getCurrentUser, getUserData, getGuestData } from './common.js';
import { shopItems } from './shopItems.js';

/**
 * 돌의 색상에 따라 적용할 최종 CSS 클래스 문자열을 반환합니다.
 * 플레이어의 장착 스킨을 확인하여 적용합니다.
 * @param {string} color - 'black' 또는 'white'
 * @returns {string} - 최종 CSS 클래스 (예: "stone skin-glass-blue-black")
 */
export function getStoneClasses(color) {
    let finalClasses = `stone ${color}`; // 기본 클래스 (예: "stone black")

    // 플레이어의 돌(검은색)일 경우에만 스킨 적용을 시도합니다.
    if (color === 'black') {
        const user = getCurrentUser();
        const currentData = user ? getUserData() : getGuestData();
        const equippedSkinId = currentData?.equippedItems?.stone_skin;

        if (equippedSkinId) {
            const equippedItem = shopItems.find(item => item.id === equippedSkinId);
            if (equippedItem && equippedItem.cssClass) {
                // 기본 'black' 클래스를 스킨 클래스로 대체합니다.
                const skinClass = `${equippedItem.cssClass}-${color}`; // 예: skin-glass-blue-black
                finalClasses = `stone ${skinClass}`;
            }
        }
    }
    
    return finalClasses;
}