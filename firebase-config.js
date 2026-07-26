/* TENMAKER - FIREBASE AUTH & FIRESTORE INTEGRATION MODULE */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInAnonymously, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// =========================================================================
// FIREBASE LIVE CONFIGURATION (발급받으신 파이어베이스 실제 설정값 연동)
// =========================================================================
const firebaseConfig = {
  apiKey: "AIzaSyCcUyTn9EPTNfvDi8UOhu1Zxul_liQarCI",
  authDomain: "tenmaker-35307.firebaseapp.com",
  projectId: "tenmaker-35307",
  storageBucket: "tenmaker-35307.firebasestorage.app",
  messagingSenderId: "755129763982",
  appId: "1:755129763982:web:492232c3b91875430421df"
};

// Firebase 앱 및 서비스 초기화
let app, auth, db;
let isFirebaseConfigured = true;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  console.log("🔥 Firebase Live SDK connected successfully!");
} catch (err) {
  console.error("Firebase Live init error:", err);
}

// -------------------------------------------------------------------------
// AUTHENTICATION API
// -------------------------------------------------------------------------

// 1) 구글 로그인
export async function loginWithGoogle() {
  if (!auth) return null;
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log("Google Login Success:", user.displayName);
    return user;
  } catch (error) {
    console.error("Google Login Error:", error);
    alert("구글 로그인 실패: " + error.message);
    throw error;
  }
}

// 2) 익명 로그인
export async function loginAnonymously() {
  if (!auth) return null;
  try {
    const result = await signInAnonymously(auth);
    console.log("Anonymous Login Success:", result.user.uid);
    return result.user;
  } catch (error) {
    console.error("Anonymous Login Error:", error);
    alert("익명 로그인 실패: " + error.message);
    throw error;
  }
}

// 3) 로그아웃
export async function logoutUser() {
  if (auth) {
    await signOut(auth);
    console.log("User Logged Out");
  }
}

// 4) Auth 상태 수신기
export function subscribeAuthChange(callback) {
  if (!auth) return;
  onAuthStateChanged(auth, (user) => {
    callback(user);
  });
}

// -------------------------------------------------------------------------
// FIRESTORE DATABASE API (유저 데이터 및 실시간 랭킹)
// -------------------------------------------------------------------------

// 유저 데이터 Firestore에 동기화
export async function syncUserDataToFirestore(uid, userData) {
  if (!db) return;
  try {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, {
      nickname: userData.nickname || '플레이어',
      gold: userData.gold || 0,
      clearCount: userData.clearCount || 0,
      bestBossTime: userData.bestBossTime || null,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log("Firestore User Data Synced:", uid);
  } catch (e) {
    console.error("Firestore sync error:", e);
  }
}

// Firestore에서 유저 데이터 로드
export async function fetchUserDataFromFirestore(uid) {
  if (!db) return null;
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (e) {
    console.error("Fetch user data error:", e);
  }
  return null;
}

// 전 세계 실시간 명예의 전당 Top 10 랭킹 조회
export async function fetchTopRankingsFromFirestore(tabName) {
  if (!db) return null;
  try {
    const usersCol = collection(db, "users");
    let q;

    if (tabName === 'time') {
      q = query(usersCol, orderBy("bestBossTime", "asc"), limit(10));
    } else if (tabName === 'gold') {
      q = query(usersCol, orderBy("gold", "desc"), limit(10));
    } else {
      q = query(usersCol, orderBy("clearCount", "desc"), limit(10));
    }

    const querySnapshot = await getDocs(q);
    let results = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (tabName === 'time' && !data.bestBossTime) return;
      results.push({
        nickname: data.nickname || '익명',
        value: tabName === 'time' ? data.bestBossTime : (tabName === 'gold' ? data.gold : data.clearCount)
      });
    });
    return results;
  } catch (e) {
    console.error("Fetch rankings error:", e);
    return null;
  }
}

export { auth, db, isFirebaseConfigured };
