// js/inventory.js

import { showPopup, getCurrentUser, getUserData, getGuestData } from './common.js';
import { shopItems } from './shopItems.js';
import { updateEquippedItemInFirebase } from './firebase.js';
import { updateEquippedItemForGuest, loadGuestData } from './guestManager.js'; // loadGuestData 추가

/**
 * 인벤토리 버튼 및 탭에 이벤트를 설정하는 초기화 함수
 */
export function setupInventory() {
    const inventoryButton = document.getElementById('inventory-btn');
    inventoryButton?.addEventListener('click', () => {
        renderInventoryItems('all'); // 기본으로 '전체' 탭을 보여줌
        showPopup('inventory-popup');
    });

    // ▼▼▼ 카테고리 탭 버튼 이벤트 리스너 추가 ▼▼▼
    const tabs = document.querySelectorAll('.inventory-tabs .tab-button');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active')); // 모든 탭에서 active 클래스 제거
            tab.classList.add('active'); // 클릭된 탭에 active 클래스 추가
            renderInventoryItems(tab.dataset.category); // 해당 카테고리 아이템 렌더링
        });
    });
}

// js/inventory.js

/**
 * 사용자가 보유한 아이템을 인벤토리 팝업에 렌더링합니다.
 * @param {string} category - 필터링할 아이템 카테고리 ('all', 'stone_skin' 등)
 */
export function renderInventoryItems(category = 'all') {
    const container = document.getElementById('inventory-items-container');
    if (!container) return;

    let currentData = getCurrentUser() ? getUserData() : getGuestData();
    const ownedItems = currentData?.ownedItems || [];
    const equippedItems = currentData?.equippedItems || {};

    container.innerHTML = '';

    const itemsToDisplay = ownedItems
        .map(itemId => shopItems.find(item => item.id === itemId))
        .filter(item => item && (category === 'all' || item.type === category));

    if (itemsToDisplay.length === 0) {
        container.innerHTML = `<p data-i18n-key="inventory_empty">보유한 아이템이 없습니다.</p>`;
        return;
    }

    itemsToDisplay.forEach(item => {
        const isEquipped = equippedItems[item.type] === item.id;
        const itemEl = document.createElement('div');
        itemEl.className = `inventory-item ${isEquipped ? 'equipped' : ''}`;

        // ★★★ 여기가 핵심 수정 부분입니다 ★★★
        let previewHtml = '';
        // 아이템 타입이 'stone_skin'인 경우, CSS로 렌더링된 돌을 생성합니다.
        if (item.type === 'stone_skin' && item.cssClass) {
            const stoneClasses = `stone ${item.cssClass}-black`;
            previewHtml = `<div class="inventory-item-preview"><div class="${stoneClasses}"></div></div>`;
        } else {
            // 그 외의 경우, 기존처럼 이미지 파일을 사용합니다.
            previewHtml = `<div class="inventory-item-preview"><img src="${item.preview}" alt="${item.name}"></div>`;
        }
        
        itemEl.innerHTML = `
            ${previewHtml}
            <div class="inventory-item-name">${item.name}</div>
            <button class="inventory-equip-btn ${isEquipped ? 'equipped' : ''}" data-item-id="${item.id}" data-item-type="${item.type}">
                ${isEquipped ? '장착됨' : '장착하기'}
            </button>
        `;

        const equipButton = itemEl.querySelector('.inventory-equip-btn');
        equipButton.addEventListener('click', (e) => {
            const itemId = e.target.dataset.itemId;
            handleEquipItem(itemId);
        });

        container.appendChild(itemEl);
    });
}

/**
 * 아이템 장착/해제 처리를 위한 핸들러 함수
 * [수정] 로컬 데이터를 즉시 업데이트하여 새로고침 없이 UI에 반영
 * @param {string} itemId - 장착/해제할 아이템의 ID
 */
async function handleEquipItem(itemId) {
    const itemToEquip = shopItems.find(item => item.id === itemId);
    if (!itemToEquip) return;

    const user = getCurrentUser();
    const currentData = user ? getUserData() : getGuestData();
    if (!currentData.equippedItems) {
        currentData.equippedItems = {};
    }

    // DB 업데이트 전에 현재 상태를 미리 확인합니다.
    const isCurrentlyEquipped = currentData.equippedItems[itemToEquip.type] === itemToEquip.id;
    const action = isCurrentlyEquipped ? 'unequipped' : 'equipped';

    try {
        // 1. DB 또는 localStorage 데이터 업데이트
        if (user) {
            await updateEquippedItemInFirebase(user.uid, itemToEquip);
        } else {
            updateEquippedItemForGuest(itemToEquip);
        }

        // ▼▼▼ [핵심 수정] 현재 페이지의 로컬 데이터를 직접 수정합니다 ▼▼▼
        if (action === 'equipped') {
            currentData.equippedItems[itemToEquip.type] = itemToEquip.id;
        } else { // unequipped
            delete currentData.equippedItems[itemToEquip.type];
        }
        // ▲▲▲ 여기까지 수정 ▲▲▲

        // 2. 결과에 따라 다른 메시지 표시
        if (action === 'equipped') {
            alert(`'${itemToEquip.name}'을(를) 장착했습니다.`);
        } else {
            alert(`'${itemToEquip.name}'을(를) 장착 해제했습니다.`);
        }

        // 3. 수정된 로컬 데이터를 기반으로 UI를 즉시 새로고침
        const activeTab = document.querySelector('.inventory-tabs .tab-button.active');
        renderInventoryItems(activeTab ? activeTab.dataset.category : 'all');

    } catch (error) {
        console.error("장착 처리 중 오류:", error);
        alert('장착에 실패했습니다. 다시 시도해 주세요.');
    }
}