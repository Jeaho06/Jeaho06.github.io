// js/firebase.js

// Firebase SDK import
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
 * @returns {Promise<{success: boolean, message: string}>}
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
            achievements: []
        };
        await setDoc(doc(db, "users", user.uid), initialData);
        return { success: true, message: '회원가입에 성공했습니다!' };
    } catch (error) {
        const message = error.code === 'auth/email-already-in-use' ? '이미 사용 중인 닉네임입니다.' : `회원가입 실패: ${error.message}`;
        return { success: false, message };
    }
}

/**
 * 로그인을 처리합니다.
 * @returns {Promise<{success: boolean, message: string}>}
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
 * 로그아웃을 처리합니다.
 */
export function logOut() {
    signOut(auth);
}

/**
 * Firestore에서 사용자 데이터를 가져옵니다.
 * @param {string} uid - 사용자 UID
 * @returns {Promise<object|null>}
 */
export async function getUserData(uid) {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
}

/**
 * Firestore에 사용자 전적을 업데이트합니다.
 * @param {string} uid - 사용자 UID
 * @param {object} stats - 새로운 전적 객체
 */
export async function updateUserStats(uid, stats) {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { stats });
}