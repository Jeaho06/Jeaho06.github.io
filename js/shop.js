// js/shop.js

import { showPopup, getCurrentUser, getUserData, getGuestData } from './common.js';
import { shopItems } from './shopItems.js';
import { purchaseItemInFirebase } from './firebase.js';
import { updateLobbySidebar } from './ui.js';
import { purchaseItemForGuest } from './guestManager.js'; 
import { renderInventoryItems } from './inventory.js';
/**
 * 상점 버튼에 클릭 이벤트를 설정하고,
 * 클릭 시 필요한 동작들을 실행하는 초기화 함수
 */
export function setupShop() {
    const shopButton = document.getElementById('open-shop-btn');
    shopButton?.addEventListener('click', () => {
        renderShopItems('all');
        showPopup('shop-popup');
    });

    const tabs = document.querySelectorAll('.shop-tabs .tab-button');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderShopItems(tab.dataset.category);
        });
    });
}
/**
 * 상점 팝업에 현재 사용자의 루나 잔액을 표시합니다.
 */
function updateShopLunaBalance() {
    const lunaBalanceEl = document.getElementById('user-luna-balance');
    if (!lunaBalanceEl) return;

    const user = getCurrentUser();
    const currentData = user ? getUserData() : getGuestData();
    const luna = currentData?.luna ?? 0;

    lunaBalanceEl.textContent = `🌙 ${luna} 루나`;
}

// js/shop.js

// js/shop.js

/**
 * shopItems.js 데이터를 기반으로 상점 아이템 목록 HTML을 생성하고 삽입합니다.
 * [수정] 'stone_skin' 타입 아이템은 CSS로 렌더링된 미리보기를 보여줍니다.
 * @param {string} category - 필터링할 아이템 카테고리 ('all', 'stone_skin' 등)
 */
function renderShopItems(category = 'all') {
    const container = document.getElementById('shop-items-container');
    if (!container) return;

    updateShopLunaBalance();
    container.innerHTML = ''; 

    const itemsToDisplay = shopItems.filter(item => category === 'all' || item.type === category);

    if (itemsToDisplay.length === 0) {
        container.innerHTML = `<p>판매하는 아이템이 없습니다.</p>`;
        return;
    }

    itemsToDisplay.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'shop-item';
        
        let previewHtml = '';
        // ★★★ 여기가 핵심입니다 ★★★
        // 아이템 타입이 'stone_skin'인 경우, CSS로 렌더링된 돌을 생성합니다.
        if (item.type === 'stone_skin' && item.cssClass) {
            const stoneClasses = `stone ${item.cssClass}-black`; // 예: stone skin-jade-black
            previewHtml = `<div class="shop-item-preview"><div class="${stoneClasses}"></div></div>`;
        } else {
            // 그 외의 경우, 기존처럼 이미지 파일을 사용합니다.
            previewHtml = `<div class="shop-item-preview"><img src="${item.preview}" alt="${item.name}"></div>`;
        }

        itemEl.innerHTML = `
            ${previewHtml}
            <div class="shop-item-name">${item.name}</div>
            <div class="shop-item-price">${item.price} 루나</div>
            <button class="shop-item-buy-btn" data-item-id="${item.id}">구매</button>
        `;

        const buyButton = itemEl.querySelector('.shop-item-buy-btn');
        buyButton.addEventListener('click', (e) => {
            const itemId = e.target.dataset.itemId;
            handlePurchase(itemId);
        });

        itemEl.addEventListener('mouseenter', () => {
            const tooltip = document.createElement('div');
            tooltip.className = 'shop-item-tooltip';
            tooltip.id = 'active-tooltip';
            tooltip.innerHTML = `<p>"${item.description}"</p>`;
            document.body.appendChild(tooltip);

            const itemRect = itemEl.getBoundingClientRect();
            tooltip.style.left = `${itemRect.right + 10}px`;
            tooltip.style.top = `${itemRect.top}px`;
        });

        itemEl.addEventListener('mouseleave', () => {
            const tooltip = document.getElementById('active-tooltip');
            if (tooltip) {
                tooltip.remove();
            }
        });

        container.appendChild(itemEl);
    });
}
// js/shop.js

// ... (파일 상단의 import 문들과 setupShop 함수 등은 그대로 유지) ...

/**
 * 아이템 구매를 처리하는 메인 함수
 * [수정] 구매 성공 시 게스트의 로컬 보유 아이템 목록도 즉시 업데이트
 * @param {string} itemId - 구매할 아이템의 ID
 */
async function handlePurchase(itemId) {
    const user = getCurrentUser();
    const itemToBuy = shopItems.find(item => item.id === itemId);

    if (!itemToBuy) {
        alert('존재하지 않는 아이템입니다.');
        return;
    }

    const confirmation = confirm(`'${itemToBuy.name}' 아이템을 ${itemToBuy.price} 루나에 구매하시겠습니까?`);
    if (!confirmation) return;

    if (user) {
        // --- 로그인 유저 구매 로직 ---
        const uData = getUserData();
        if (uData.ownedItems && uData.ownedItems.includes(itemId)) {
            alert('이미 보유하고 있는 아이템입니다.');
            return;
        }
        if (uData.luna < itemToBuy.price) {
            alert('루나가 부족합니다.');
            return;
        }
        try {
            await purchaseItemInFirebase(user.uid, itemId, itemToBuy.price);
            
            uData.luna -= itemToBuy.price;
            if (!uData.ownedItems) uData.ownedItems = [];
            uData.ownedItems.push(itemId);

            alert('구매에 성공했습니다!');
            updateShopLunaBalance();
            updateLobbySidebar(uData);
            renderInventoryItems();

        } catch (error) {
            console.error("구매 처리 중 오류 발생:", error);
            alert('구매에 실패했습니다. 다시 시도해 주세요.');
        }

    } else {
        // --- 게스트 유저 구매 로직 ---
        const gData = getGuestData();
        const result = purchaseItemForGuest(itemId, itemToBuy.price);
        
        if(result.success) {
            gData.luna -= itemToBuy.price;
            // ▼▼▼ [핵심 수정] 게스트의 보유 아이템 배열도 직접 업데이트합니다 ▼▼▼
            if (!gData.ownedItems) gData.ownedItems = [];
            gData.ownedItems.push(itemId);
            // ▲▲▲ 여기까지 수정 ▲▲▲
        }
        
        alert(result.message);
        if (result.success) {
            updateShopLunaBalance();
            updateLobbySidebar(gData);
            renderInventoryItems();
        }
    }
}