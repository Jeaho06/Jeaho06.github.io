// js/shopItems.js

export const shopItems = [
    {
        id: 'stone_skin_glass_blue', // 아이템 고유 ID
        type: 'stone_skin',          // 아이템 종류 (바둑돌 스킨)
        name: '청옥 바둑알',         // 상점에 표시될 이름
        price: 150,                  // 가격 (루나)
        description: '광부가 심해에서 직접 캐온 푸른 보석으로 만들었습니다. 내구성이 좋아 보입니다.',
        preview: '/image/items/stone_blue_glass.png',             // 상점에서 보여줄 간단한 미리보기
        cssClass: 'skin-jade'  // 실제 적용될 CSS 클래스 이름
    },

    {
        id: 'stone_skin_galaxy',
        type: 'stone_skin',
        name: '은하수 바둑알',
        price: 150, // 희귀하므로 가격을 더 높게 책정
        description: '밤하늘의 은하수를 그대로 담아낸 듯한 신비로운 바둑돌입니다.',
        cssClass: 'skin-galaxy', // skins.css에 추가한 새 클래스 이름
        name_key: 'item_name_galaxy_stone'
    },

    {
        id: 'stone_skin_najeon',
        type: 'stone_skin',
        name: '무지개 바둑알',
        price: 150,
        description: '장인의 손길로 완성된 오색찬란한 무지개 바둑돌입니다. 빛의 각도에 따라 다채롭게 빛납니다.',
        cssClass: 'skin-najeon', // skins.css에 추가한 새 클래스 이름
        name_key: 'item_name_najeon_stone'
    }
// ...
];