// js/firebase.js

// Firebase SDK import
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
// --- [수정] runTransaction을 추가로 import 합니다. ---
import { arrayUnion, FieldValue, getFirestore, doc, setDoc, getDoc, updateDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// [중요] YOUR... 부분들을 실제 본인의 Firebase 프로젝트 값으로 반드시 교체해야 합니다.
const firebaseConfig = {
  apiKey: "API_KEY",
  authDomain: "AUTH_DOMAIN",
  projectId: "PROJECT_ID",
  storageBucket: "STORAGE_BUCKET",
  messagingSenderId: "MESSAGING_SENDER_ID",
  appId: "APP_ID",
  measurementId: "MEASUREMENT_ID"
};

// 다른 파일에서 사용할 수 있도록 export 합니다.
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * 신규 회원 가입을 처리합니다.
 */
export async function signUp(nickname, password) {
    const nicknameRegex = /^[a-zA-Z0-9]{2,10}$/;
    if (!nicknameRegex.test(nickname)) {
        return { success: false, message: '닉네임은 2~10자의 영문/숫자만 사용 가능합니다.' };
    }
    const fakeEmail = `${nickname.trim().toLowerCase()}@omok.game`;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, password);
        const user = userCredential.user;
        const initialData = {
            nickname: nickname.trim(),
            stats: { wins: 0, losses: 0, draws: 0 },
            // --- [수정] 레벨, 경험치 및 일일 보너스 추적을 위한 필드 추가 ---
            level: 1,
            experience: 0,
            lastWinTimestamp: null, // 마지막 승리 시간을 기록하기 위함
            luna: 100 // ▼▼▼ 신규 가입 시 기본 루나 지급 ▼▼▼
        };
        await setDoc(doc(db, "users", user.uid), initialData);
        return { success: true, message: '회원가입에 성공했습니다!' };
    } catch (error) {
        const message = error.code === 'auth/email-already-in-use' ? '이미 사용 중인 닉네임입니다.' : `회원가입 실패: ${error.message}`;
        return { success: false, message };
    }
}

/**
 * 로그인을 처리합니다. (수정 없음)
 */
export async function logIn(nickname, password) {
    const fakeEmail = `${nickname.trim().toLowerCase()}@omok.game`;
    try {
        await signInWithEmailAndPassword(auth, fakeEmail, password);
        return { success: true, message: '로그인에 성공했습니다!' };
    } catch (error) {
        return { success: false, message: '로그인 정보가 올바르지 않습니다.' };
    }
}

/**
 * 로그아웃을 처리합니다. (수정 없음)
 */
export function logOut() {
    signOut(auth);
}

/**
 * Firestore에서 사용자 데이터를 가져옵니다. (수정 없음)
 */
export async function getUserData(uid) {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
}

/**
 * [최종 적용] 사진 속 제안 모델 (계단식 + 주기적 허들)을 사용하여
 * 특정 레벨에서 다음 레벨로 올라가는 데 필요한 경험치를 계산합니다.
 * @param {number} level - 현재 레벨
 * @returns {number} - 레벨업에 필요한 경험치
 */
export function getRequiredXpForLevel(level) {
    // 0레벨 또는 음수 레벨에 대한 예외 처리
    if (level < 1) {
        return 0;
    }

    // 1. 주기적인 허들 배율(F1, F2, F3) 계산
    const F1 = (level % 5 === 0) ? 1.3 : 1;
    const F2 = (level % 15 === 0) ? 1.4 : 1;
    const F3 = (level % 45 === 0) ? 1.5 : 1;

    // 2. 계단식으로 증가하는 기본 경험치(BaseXP) 계산
    const baseXp = 120 +
                 Math.floor(level / 5) * 60 +
                 Math.floor(Math.pow(level, 2) / 225) * 120 +
                 Math.floor(Math.pow(level, 2) / 2025) * 180;

    // 3. 최종 경험치 = 기본 경험치 * 모든 허들 배율
    const requiredXp = F1 * F2 * F3 * baseXp;

    return Math.floor(requiredXp);
}

// --- [교체] updateUserStats 함수를 아래의 새로운 함수로 완전히 대체합니다. ---
/**
 * 게임 종료 후 사용자의 전적, 경험치, 레벨을 안전하게 업데이트합니다. (트랜잭션 사용)
 * @param {string} uid - 사용자 UID
 * @param {'win' | 'loss' | 'draw'} gameResult - 게임 결과
 * @param {number} moveCount - 이번 게임의 총 착수 횟수
 * @returns {Promise<object>} 업데이트 결과 (획득 경험치, 레벨업 여부 등)
 */

// js/firebase.js

// ... (다른 부분은 그대로) ...

// firebase.js 파일의 updateUserGameResult 함수를 아래 코드로 전체 교체해주세요.
const REWARD_TABLE = {
    veto: { xp: 5, luna: 2 },
    bomb: { xp: 10, luna: 5 },
    doubleMove: { xp: 15, luna: 8 },
    swap: { xp: 20, luna: 10 }
};

export async function updateUserGameResult(uid, gameResult, moveCount, activeCheats = {}) {
    const XP_TABLE = { win: 50, loss: 10, draw: 20 };
    const LUNA_TABLE = { win: 20, loss: 5, draw: 10 };
    const DAILY_BONUS = 100;
    const XP_PER_MOVE_CAP = 15;
    const userRef = doc(db, "users", uid);

    try {
        return await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) { throw "Document does not exist!"; }

            const oldData = userDoc.data();
            
            // 1. 전체 전적 업데이트
            const stats = oldData.stats || { wins: 0, losses: 0, draws: 0 };
            if (gameResult === 'win') stats.wins++;
            else if (gameResult === 'loss') stats.losses++;
            else if (gameResult === 'draw') stats.draws++;

            // ▼▼▼ [핵심] 반칙별 전적 업데이트 로직 ▼▼▼
            const stats_by_cheat = oldData.stats_by_cheat || {};
            // 무승부는 반칙별 전적에 기록하지 않습니다.
            if (gameResult === 'win' || gameResult === 'loss') { 
                for (const cheat in activeCheats) {
                    // 활성화된 반칙에 대해서만 기록합니다.
                    if (activeCheats[cheat] === true) {
                        // 해당 반칙에 대한 기록이 없으면 { wins: 0, losses: 0 } 으로 초기화합니다.
                        if (!stats_by_cheat[cheat]) {
                            stats_by_cheat[cheat] = { wins: 0, losses: 0 };
                        }
                        // 승/패에 따라 카운트를 1 증가시킵니다.
                        if (gameResult === 'win') {
                            stats_by_cheat[cheat].wins++;
                        } else {
                            stats_by_cheat[cheat].losses++;
                        }
                    }
                }
            }
            // ▲▲▲ 로직 추가 완료 ▲▲▲

            // --- 기존 경험치 및 루나 계산 (보너스 포함) ---
            let level = oldData.level || 1;
            let experience = oldData.experience || 0;
            let luna = oldData.luna || 0;
            
            let xpGained = XP_TABLE[gameResult];
            xpGained += Math.min(moveCount, XP_PER_MOVE_CAP);

            let lunaGained = LUNA_TABLE[gameResult];

            let bonusXp = 0;
            let bonusLuna = 0;
            if (gameResult === 'win') {
                for (const cheat in activeCheats) {
                    if (activeCheats[cheat] === true && REWARD_TABLE[cheat]) {
                        bonusXp += REWARD_TABLE[cheat].xp;
                        bonusLuna += REWARD_TABLE[cheat].luna;
                    }
                }
            }
            xpGained += bonusXp;
            lunaGained += bonusLuna;
            
            let didGetDailyBonus = false;
            if (gameResult === 'win') {
                const now = new Date();
                const lastWinDate = oldData.lastWinTimestamp ? oldData.lastWinTimestamp.toDate() : null;
                if (!lastWinDate || lastWinDate.toDateString() !== now.toDateString()) {
                    xpGained += DAILY_BONUS;
                    didGetDailyBonus = true;
                }
            }
            
            experience += xpGained;
            luna += lunaGained;

            let didLevelUp = false;
            let requiredXp = getRequiredXpForLevel(level);
            while (experience >= requiredXp) {
                level++;
                experience -= requiredXp;
                requiredXp = getRequiredXpForLevel(level);
                didLevelUp = true;
            }

            // 5. 데이터베이스에 업데이트할 최종 데이터를 준비합니다.
            const newData = {
                stats,
                stats_by_cheat, // <<< 새로 추가된 데이터를 업데이트 목록에 포함
                level,
                experience,
                luna,
                lastWinTimestamp: (gameResult === 'win' && didGetDailyBonus) ? serverTimestamp() : oldData.lastWinTimestamp
            };
            
            transaction.update(userRef, newData);
            
            // 6. 프론트엔드에 전달할 결과 반환
            return {
                oldData: oldData, // UI 계산을 위해 계산 직전의 원본 데이터를 반환
                xpGained,
                didLevelUp,
                newLevel: level,
                newExperience: experience,
                didGetDailyBonus,
                lunaGained,
                bonusXp,
                bonusLuna
            };
        });
    } catch (e) {
        console.error("전적 업데이트 트랜잭션 실패: ", e);
        return null;
    }
}

/**
 * Firestore 트랜잭션을 사용하여 아이템 구매를 처리합니다.
 * (사용자 루나 차감 및 아이템 추가)
 * @param {string} userId - 사용자 UID
 * @param {string} itemId - 구매한 아이템 ID
 * @param {number} itemPrice - 아이템 가격
 */
export async function purchaseItemInFirebase(userId, itemId, itemPrice) {
    const userRef = doc(db, "users", userId);

    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) {
                throw "유저 문서를 찾을 수 없습니다.";
            }

            const currentLuna = userDoc.data().luna || 0;
            if (currentLuna < itemPrice) {
                throw "루나가 부족합니다.";
            }

            const newLuna = currentLuna - itemPrice;
            
            transaction.update(userRef, {
                luna: newLuna,
                ownedItems: arrayUnion(itemId) // 배열에 아이템 ID 추가
            });
        });
    } catch (e) {
        console.error("Firebase 트랜잭션 실패: ", e);
        throw e; // 에러를 다시 던져서 호출한 쪽에서 처리하게 함
    }
}

/**
 * 사용자의 장착 아이템 정보를 Firestore에 업데이트합니다. (트랜잭션 사용)
 * [수정] 장착/해제 로직을 모두 처리하고, 결과를 반환합니다.
 * @param {string} userId - 사용자 UID
 * @param {object} itemToEquip - 장착할 아이템 객체
 * @returns {Promise<string>} 'equipped' 또는 'unequipped' 문자열을 반환
 */
export async function updateEquippedItemInFirebase(userId, itemToEquip) {
    const userRef = doc(db, "users", userId);
    const equippedField = `equippedItems.${itemToEquip.type}`;

    try {
        const result = await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) {
                throw "유저 문서를 찾을 수 없습니다.";
            }

            const equippedItems = userDoc.data().equippedItems || {};
            let action = 'equipped'; // 기본 동작은 '장착'

            // 현재 아이템이 이미 장착되어 있는지 확인
            if (equippedItems[itemToEquip.type] === itemToEquip.id) {
                // 장착 해제 로직: 해당 필드를 삭제합니다.
                transaction.update(userRef, {
                    [equippedField]: FieldValue.delete()
                });
                action = 'unequipped';
            } else {
                // 장착 로직
                transaction.update(userRef, {
                    [equippedField]: itemToEquip.id
                });
            }
            return action;
        });
        return result;
    } catch (e) {
        console.error("Firebase 장착 트랜잭션 실패: ", e);
        throw e;
    }
}