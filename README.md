# 🎮 TENMAKER (텐메이커 - 10의 연금술사)

숫자 10의 보수 연산을 재미있게 연습하는 3가지 미니게임, 모은 골드로 도전하는 10문제 연속 타임어택 보스 레이드, 전 세계 플레이어와 랭킹을 겨루는 명예의 전당 웹 게임 프로젝트입니다.

---

## 🌟 주요 기능

1. **연습 미니게임 3종 (제한시간 25초)**:
   - 🔗 **10 짝짓기**: 12개 숫자 타일 중 합이 10이 되는 짝을 연결하여 파괴!
   - 🧱 **10 블럭 크러시**: 5x5 격자에서 상하좌우 인접 블럭 합이 10이면 파괴! (3번 원형, 4번 노란색, 실감나는 중력 낙하 연출)
   - ⚡ **10 수식 스피드 러시**: `? + 4 = 10`, `10 - ? = 3` 수식 정답을 빠른 속도로 맞추는 퀴즈
2. **👹 10의 마왕 보스 레이드**:
   - 100 Gold로 도전, 10문제 연속 스피드런 타임어택 (초/밀리초 측정 및 보스 HP 차감)
3. **🔥 Firebase 연동 (Authentication & Firestore)**:
   - **Google 로그인** & **익명 로그인** 지원
   - **실시간 명예의 전당 (Top 10)**: ⏱️ 보스전 스피드런 최단 시간, 💰 보유 골드, 🎖️ 클리어 수 랭킹
4. **🚀 Vercel 배포 지원**: Vercel에 GitHub 연동으로 1초 만에 무료 웹 앱 호스팅 가능

---

## 🛠️ 프로젝트 설치 및 로컬 실행

별도의 빌드 과정 없이 정적 웹 서버나 VS Code Live Server로 실행할 수 있습니다.

```bash
# 로컬 웹 서버 실행 예시 (Node.js)
npx http-server -p 8080
```
브라우저에서 `http://localhost:8080` 접속!

---

## 🔥 Firebase 연동 설정 안내

1. [Firebase Console](https://console.firebase.google.com/)에 접속하여 프로젝트를 생성합니다.
2. **Authentication** ➔ **Sign-in method**에서 **Google** 및 **익명(Anonymous)**을 활성화합니다.
3. **Firestore Database**를 생성하고 테스트 모드로 규칙(Rules)을 시작합니다.
4. Firebase 웹 앱 등록 후 발급받은 Config 값을 `firebase-config.js` 파일에 입력합니다:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

---

## 🐙 GitHub에 올리기

터미널에서 아래 명령어들을 실행해 본인의 GitHub 저장소에 올립니다:

```bash
git init
git add .
git commit -m "feat: TenMaker Firebase & Vercel ready project"
git branch -M main
git remote add origin https://github.com/사용자아이디/tenmaker.git
git push -u origin main
```

---

## 🚀 Vercel 배포하기

1. [Vercel](https://vercel.com/)에 로그인합니다.
2. **Add New...** ➔ **Project** 선택 후 위 GitHub `tenmaker` 저장소를 Import 합니다.
3. **Deploy** 버튼을 누르면 약 10초 내로 자신만의 무료 사이트 URL(`https://tenmaker.vercel.app`)이 생성됩니다!
