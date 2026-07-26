/* TENHEROES - FIREBASE AUTH & FIRESTORE INTEGRATION MODULE */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
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

// FIREBASE LIVE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyCcUyTn9EPTNfvDi8UOhu1Zxul_liQarCI",
  authDomain: "tenmaker-35307.firebaseapp.com",
  projectId: "tenmaker-35307",
  storageBucket: "tenmaker-35307.firebasestorage.app",
  messagingSenderId: "755129763982",
  appId: "1:755129763982:web:492232c3b91875430421df"
};

let app, auth, db;
let isFirebaseConfigured = true;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  console.log("🔥 Firebase Live SDK connected successfully!");

  // 모바일 리디렉션 로그인 결과 자동 수신 처리
  getRedirectResult(auth).then((result) => {
    if (result && result.user) {
      console.log("Mobile Redirect Login Success:", result.user.displayName);
    }
  }).catch((error) => {
    console.error("Redirect Result Error:", error);
  });
} catch (err) {
  console.error("Firebase Live init error:", err);
}

// ---------------------------------------------------------
// AUTHENTICATION API (모바일 스마트폰 지원 강화)
// ---------------------------------------------------------

// 1) 구글 로그인 (PC는 팝업, 모바일은 리디렉션 자동 감지)
export async function loginWithGoogle() {
  if (!auth) return null;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    // 모바일 브라우저인 경우 팝업 차단 방지용 리디렉션 로그인 실행
    try {
      await signInWithRedirect(auth, provider);
      return null;
    } catch (e) {
      console.error("Mobile Redirect Login Error:", e);
      throw e;
    }
  } else {
    // PC 브라우저인 경우 팝업 로그인 실행
    try {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (error) {
      // 만약 PC에서도 팝업이 차단된 경우 리디렉션으로 자동 재시도
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
        console.warn("Popup blocked, trying redirect fallback...");
        await signInWithRedirect(auth, provider);
        return null;
      }
      throw error;
    }
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

// ---------------------------------------------------------
// FIRESTORE DATABASE API
// ---------------------------------------------------------
export async function syncUserDataToFirestore(uid, userData) {
  if (!db) return;
  try {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, {
      nickname: userData.nickname || '영웅',
      gold: userData.gold || 0,
      clearCount: userData.clearCount || 0,
      bestBossTime: userData.bestBossTime || null,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.error("Firestore sync error:", e);
  }
}

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
        nickname: data.nickname || '익명영웅',
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
