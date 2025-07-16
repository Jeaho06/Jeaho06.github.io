// js/firebase.js

// Firebase SDK import
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
// --- [수정] runTransaction을 추가로 import 합니다. ---
import { getFirestore, doc, setDoc, getDoc, updateDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// --- [추가] 레벨업에 필요한 경험치를 계산하는 헬퍼 함수 ---
export function getRequiredXpForLevel(level) {
    return Math.floor(100 * Math.pow(1.5, level - 1));
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

export async function updateUserGameResult(uid, gameResult, moveCount) {
    const XP_TABLE = { win: 150, loss: 10, draw: 20 };
    const LUNA_TABLE = { win: 20, loss: 5, draw: 10 };
    const XP_PER_MOVE_CAP = 15;
    const DAILY_BONUS = 100;
    const userRef = doc(db, "users", uid);

    try {
        return await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) { throw "Document does not exist!"; }

            const oldData = userDoc.data();
            
            // ▼▼▼ 바로 이 부분이 수정의 핵심입니다! ▼▼▼
            // 기존 유저에게 level, experience 필드가 없을 경우 기본값을 1과 0으로 설정합니다.
            const stats = oldData.stats || { wins: 0, losses: 0, draws: 0 };
            let level = oldData.level || 1;
            let experience = oldData.experience || 0;
            const lastWinTimestamp = oldData.lastWinTimestamp || null;
            // ▲▲▲ 여기까지 입니다 ▲▲▲

            // 1. 전적 업데이트
            if (gameResult === 'win') stats.wins++;
            else if (gameResult === 'loss') stats.losses++;
            else if (gameResult === 'draw') stats.draws++;

            // 2. 경험치 계산
            let xpGained = XP_TABLE[gameResult];
            xpGained += Math.min(moveCount, XP_PER_MOVE_CAP);

            let didGetDailyBonus = false;
            if (gameResult === 'win') {
                const now = new Date();
                const lastWinDate = lastWinTimestamp ? lastWinTimestamp.toDate() : null;
                if (!lastWinDate || lastWinDate.toDateString() !== now.toDateString()) {
                    xpGained += DAILY_BONUS;
                    didGetDailyBonus = true;
                }
            }
            
            experience += xpGained;

            const lunaGained = LUNA_TABLE[gameResult];
            luna += lunaGained;

            // 3. 레벨업 체크
            let didLevelUp = false;
            let requiredXp = getRequiredXpForLevel(level);
            while (experience >= requiredXp) {
                level++;
                experience -= requiredXp;
                requiredXp = getRequiredXpForLevel(level);
                didLevelUp = true;
            }

            // 4. 데이터베이스 업데이트 준비
            const newData = {
                stats,
                level,
                experience,
                luna,
                lastWinTimestamp: (gameResult === 'win' && didGetDailyBonus) ? serverTimestamp() : lastWinTimestamp
            };
            transaction.update(userRef, newData);
            
            // 5. 프론트엔드에 전달할 결과 반환
            return {
                xpGained,
                didLevelUp,
                newLevel: level,
                didGetDailyBonus,
                lunaGained
            };
        });
    } catch (e) {
        console.error("레벨 업데이트 트랜잭션 실패: ", e);
        return null;
    }
}