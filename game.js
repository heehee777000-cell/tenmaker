/* TENMAKER - MAIN GAME ENGINE & LOGIC */

const TenGame = (() => {
  // ----------------------------------------------------
  // STATE MANAGEMENT
  // ----------------------------------------------------
  let state = {
    user: null,
    uid: 'local_player',
    nickname: '로그인',
    gold: 150,
    clearCount: 0,
    bestBossTime: null,
    activeScreen: 'mainMenu',
    currentTab: 'time'
  };

  let currentGame = null;
  let gameInterval = null;
  let timerInterval = null;
  let firebaseModule = null;

  async function initFirebaseModule() {
    try {
      firebaseModule = await import('./firebase-config.js');
      if (firebaseModule && firebaseModule.subscribeAuthChange) {
        firebaseModule.subscribeAuthChange(async (firebaseUser) => {
          if (firebaseUser) {
            state.user = firebaseUser;
            state.uid = firebaseUser.uid;
            state.nickname = firebaseUser.displayName || (state.nickname === '로그인' ? '10연금술사' : state.nickname);
            
            const dbData = await firebaseModule.fetchUserDataFromFirestore(firebaseUser.uid);
            if (dbData) {
              state.gold = dbData.gold ?? state.gold;
              state.clearCount = dbData.clearCount ?? state.clearCount;
              state.bestBossTime = dbData.bestBossTime ?? state.bestBossTime;
              state.nickname = dbData.nickname || state.nickname;
            } else {
              await firebaseModule.syncUserDataToFirestore(firebaseUser.uid, state);
            }
          } else {
            state.user = null;
            state.uid = 'local_player';
            state.nickname = '로그인';
          }
          updateHeaderUI();
        });
      }
    } catch (e) {
      console.warn("Firebase Module Load Warning (Local fallback mode):", e);
    }
  }

  const defaultRankings = {
    time: [
      { nickname: '수학신동', value: 4.82 },
      { nickname: '스피드킹', value: 5.15 },
      { nickname: '10마스터', value: 5.90 },
      { nickname: '빛의연산자', value: 6.42 },
      { nickname: '블럭파괴자', value: 7.10 },
      { nickname: '짝짓기달인', value: 8.35 },
      { nickname: '알파고', value: 9.20 },
      { nickname: '텐메이커77', value: 10.45 },
      { nickname: '초보연금술사', value: 12.10 },
      { nickname: '기억의신', value: 14.80 }
    ],
    gold: [
      { nickname: '황금손', value: 3500 },
      { nickname: '10마스터', value: 2800 },
      { nickname: '부자왕', value: 2100 },
      { nickname: '수학신동', value: 1950 },
      { nickname: '골드헌터', value: 1500 },
      { nickname: '블럭파괴자', value: 1200 },
      { nickname: '알파고', value: 980 },
      { nickname: '빛의연산자', value: 850 },
      { nickname: '짝짓기달인', value: 600 },
      { nickname: '스피드킹', value: 450 }
    ],
    clear: [
      { nickname: '노력파', value: 84 },
      { nickname: '10마스터', value: 62 },
      { nickname: '황금손', value: 51 },
      { nickname: '블럭파괴자', value: 43 },
      { nickname: '수학신동', value: 39 },
      { nickname: '짝짓기달인', value: 31 },
      { nickname: '스피드킹', value: 25 },
      { nickname: '빛의연산자', value: 20 },
      { nickname: '골드헌터', value: 17 },
      { nickname: '알파고', value: 14 }
    ]
  };

  function loadData() {
    const savedUser = localStorage.getItem('tenmaker_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        state.nickname = parsed.nickname || '로그인';
        state.gold = parsed.gold ?? state.gold;
        state.clearCount = parsed.clearCount ?? state.clearCount;
        state.bestBossTime = parsed.bestBossTime ?? null;
      } catch (e) { console.error(e); }
    }

    const savedRankings = localStorage.getItem('tenmaker_rankings');
    if (!savedRankings) {
      localStorage.setItem('tenmaker_rankings', JSON.stringify(defaultRankings));
    }

    updateHeaderUI();
  }

  function saveData() {
    localStorage.setItem('tenmaker_user', JSON.stringify({
      nickname: state.nickname,
      gold: state.gold,
      clearCount: state.clearCount,
      bestBossTime: state.bestBossTime
    }));

    if (firebaseModule && state.user) {
      firebaseModule.syncUserDataToFirestore(state.user.uid, state);
    }
    updateHeaderUI();
  }

  function getRankings() {
    const data = localStorage.getItem('tenmaker_rankings');
    return data ? JSON.parse(data) : defaultRankings;
  }

  function saveRankings(rankingsObj) {
    localStorage.setItem('tenmaker_rankings', JSON.stringify(rankingsObj));
  }

  function updateHeaderUI() {
    const pName = document.getElementById('playerNickname');
    const authIcon = document.getElementById('userAuthIcon');

    if (state.user) {
      pName.innerText = state.nickname;
      authIcon.className = state.user.isAnonymous ? 'fa-solid fa-user-secret' : 'fa-brands fa-google';
    } else {
      pName.innerText = '로그인';
      authIcon.className = 'fa-solid fa-user-astronaut';
    }

    document.getElementById('userGold').innerText = state.gold.toLocaleString();
    document.getElementById('userClearCount').innerText = state.clearCount;
    
    const bestTimeStr = state.bestBossTime ? `${state.bestBossTime.toFixed(2)}초` : '미기록';
    document.getElementById('bestTimeDisplay').innerText = `내 최단 기록: ${bestTimeStr}`;
  }

  function openAuthModal() {
    const modal = document.getElementById('authModal');
    if (!modal) return;

    const optBox = document.getElementById('authOptions');
    const profileBox = document.getElementById('authProfileView');

    if (state.user) {
      optBox.style.display = 'none';
      profileBox.style.display = 'flex';
      document.getElementById('loggedInName').innerText = state.nickname;
      document.getElementById('loggedInType').innerText = state.user.isAnonymous ? '👤 익명 계정' : `🌐 구글 계정 (${state.user.email || ''})`;
      document.getElementById('nicknameInput').value = state.nickname;
    } else {
      optBox.style.display = 'flex';
      profileBox.style.display = 'none';
    }
    modal.classList.add('active');
  }

  function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('active');
  }

  async function handleGoogleLogin() {
    if (!firebaseModule) await initFirebaseModule();
    if (firebaseModule && firebaseModule.loginWithGoogle) {
      try {
        const user = await firebaseModule.loginWithGoogle();
        if (user) {
          closeAuthModal();
          alert(`🎉 환영합니다, ${user.displayName || '플레이어'}님!`);
        }
      } catch (e) { console.error(e); }
    }
  }

  async function handleAnonLogin() {
    if (!firebaseModule) await initFirebaseModule();
    if (firebaseModule && firebaseModule.loginAnonymously) {
      try {
        const user = await firebaseModule.loginAnonymously();
        if (user) {
          closeAuthModal();
          alert("👤 익명 계정으로 로그인되었습니다. 기록이 안전하게 저장됩니다!");
        }
      } catch (e) { console.error(e); }
    }
  }

  async function handleLogout() {
    if (firebaseModule && firebaseModule.logoutUser) {
      await firebaseModule.logoutUser();
      state.user = null;
      state.nickname = '로그인';
      closeAuthModal();
      alert("로그아웃 되었습니다.");
      updateHeaderUI();
    }
  }

  const instructionsData = {
    connect: {
      icon: '🔗',
      title: '10 짝짓기 (Ten Connect)',
      desc: '25초 동안 화면의 숫자 타일 중 합이 10이 되는 짝을 찾아 짝지어 보세요!',
      rules: [
        '첫 번째 숫자 타일을 선택 후, 합이 10이 되는 짝꿍 타일을 터치합니다.',
        '짝이 맞으면 타일이 파괴되며 점수(+120)와 골드(+12)를 획득합니다.',
        '판의 타일을 모두 지우면 새 타일 판이 공급됩니다.'
      ],
      action: () => startMiniGame('connect')
    },
    block: {
      icon: '🧱',
      title: '10 블럭 크러시 (Block Crash 10)',
      desc: '25초 동안 격자판에서 상하좌우로 붙어있는 인접 블럭의 합이 10이면 파괴!',
      rules: [
        '상하좌우로 붙어있는 두 블럭 중 합이 10이 되는 조합을 선택하세요.',
        '3번 블럭은 원형, 4번 블럭은 노란색! 숫자가 터지면 위 블럭이 떨어집니다.',
        '💡 만들 수 있는 10 짝이 없으면 팝업 안내 후 판이 자동으로 새로 섞입니다!'
      ],
      action: () => startMiniGame('block')
    },
    math: {
      icon: '⚡',
      title: '10 수식 스피드 러시 (Math Rush 10)',
      desc: '25초 동안 빠르게 출제되는 10 만들기 수식의 빈칸 정답을 빛의 속도로 탭하세요!',
      rules: [
        '? + 4 = 10, 10 - ? = 3 등의 빈칸 수식이 출제됩니다.',
        '아래 4개 보기 중 정답 숫자를 클릭하세요.',
        '연속으로 정답을 맞추면 콤보 보너스 골드가 지급됩니다.'
      ],
      action: () => startMiniGame('math')
    },
    boss: {
      icon: '👹',
      title: '10의 마왕 보스 레이드 (Boss Raid)',
      desc: '10을 만드는 10개의 핵심 퀴즈를 연속으로 해결해 최단 클리어 기록에 도전하세요!',
      rules: [
        '도전 조건: 100 Gold 소모.',
        '10문제를 정답 제출할 때마다 보스의 HP가 감소합니다.',
        '오답 제출 시 +1초 시간 패널티가 부과됩니다.',
        '10문제를 모두 풀면 보스 퇴치 완료! 소요 시간이 명예의 전당 랭킹에 등록됩니다.'
      ],
      action: () => startBossRaid()
    }
  };

  function openInstruction(type) {
    const data = instructionsData[type];
    if (!data) return;

    document.getElementById('instructIcon').innerText = data.icon;
    document.getElementById('instructTitle').innerText = data.title;
    document.getElementById('instructDesc').innerText = data.desc;

    const rulesContainer = document.getElementById('instructRules');
    rulesContainer.innerHTML = '';
    data.rules.forEach(rule => {
      const item = document.createElement('div');
      item.className = 'instruct-rule-item';
      item.innerHTML = `<i class="fa-solid fa-check-circle"></i> <span>${rule}</span>`;
      rulesContainer.appendChild(item);
    });

    const startBtn = document.getElementById('instructStartBtn');
    startBtn.onclick = () => {
      closeInstruction();
      data.action();
    };

    document.getElementById('instructionModal').classList.add('active');
  }

  function closeInstruction() {
    const modal = document.getElementById('instructionModal');
    if (modal) modal.classList.remove('active');
  }

  // ----------------------------------------------------
  // MINI GAME 1: 10 짝짓기 (TEN CONNECT) (25s)
  // ----------------------------------------------------
  function initConnectGame() {
    const playArea = document.getElementById('playArea');
    playArea.innerHTML = '<div id="connectGrid" class="connect-grid-container"></div>';
    const grid = document.getElementById('connectGrid');

    let score = 0;
    let earnedGold = 0;
    let selectedTile = null;

    function setupTiles() {
      grid.innerHTML = '';
      selectedTile = null;

      let values = [];
      for (let i = 0; i < 6; i++) {
        let a = Math.floor(Math.random() * 9) + 1;
        let b = 10 - a;
        values.push(a, b);
      }
      values.sort(() => Math.random() - 0.5);

      values.forEach((val, idx) => {
        const tile = document.createElement('div');
        tile.className = 'connect-tile';
        tile.innerText = val;
        tile.dataset.val = val;
        tile.dataset.idx = idx;

        tile.onclick = () => onTileClick(tile, val);
        grid.appendChild(tile);
      });
    }

    function onTileClick(tile, val) {
      if (tile.classList.contains('matched')) return;

      if (!selectedTile) {
        selectedTile = { el: tile, val };
        tile.classList.add('selected');
      } else if (selectedTile.el === tile) {
        tile.classList.remove('selected');
        selectedTile = null;
      } else {
        const sum = selectedTile.val + val;
        if (sum === 10) {
          score += 120;
          earnedGold += 12;
          document.getElementById('gameScore').innerText = score;
          document.getElementById('gameEarnedGold').innerText = earnedGold;

          selectedTile.el.classList.remove('selected');
          selectedTile.el.style.visibility = 'hidden';
          selectedTile.el.classList.add('matched');

          tile.style.visibility = 'hidden';
          tile.classList.add('matched');

          selectedTile = null;

          const remaining = grid.querySelectorAll('.connect-tile:not(.matched)');
          if (remaining.length === 0) {
            setTimeout(setupTiles, 300);
          }
        } else {
          selectedTile.el.classList.remove('selected');
          tile.style.animation = 'bossShake 0.3s ease';
          setTimeout(() => tile.style.animation = '', 300);
          selectedTile = null;
        }
      }
    }

    setupTiles();

    return {
      name: '🔗 10 짝짓기',
      getScore: () => score,
      getEarnedGold: () => earnedGold
    };
  }

  // ----------------------------------------------------
  // MINI GAME 2: 10 블럭 크러시 (BLOCK CRASH 10) - AUTO SHUFFLE & POPUP NOTICE
  // ----------------------------------------------------
  function initBlockGame() {
    const playArea = document.getElementById('playArea');
    playArea.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:12px; width:100%;">
        <div id="blockBoard" class="block-board"></div>
        <button id="shuffleBtn" class="btn-secondary" style="font-size:0.85rem; padding:6px 14px; border-radius:20px;">
          🔀 블럭 섞기
        </button>
      </div>
    `;
    const board = document.getElementById('blockBoard');
    const shuffleBtn = document.getElementById('shuffleBtn');

    const ROWS = 5;
    const COLS = 5;
    let gridData = [];
    let score = 0;
    let earnedGold = 0;
    let selectedBlock = null;

    function hasValidMove() {
      const dr = [-1, 1, 0, 0];
      const dc = [0, 0, -1, 1];

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const val1 = gridData[r][c];
          if (val1 === 0) continue;

          for (let i = 0; i < 4; i++) {
            const nr = r + dr[i];
            const nc = c + dc[i];
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
              const val2 = gridData[nr][nc];
              if (val2 > 0 && val1 + val2 === 10) {
                return true;
              }
            }
          }
        }
      }
      return false;
    }

    function createBoard() {
      board.innerHTML = '';
      gridData = [];

      do {
        for (let r = 0; r < ROWS; r++) {
          gridData[r] = [];
          for (let c = 0; c < COLS; c++) {
            gridData[r][c] = Math.floor(Math.random() * 9) + 1;
          }
        }
      } while (!hasValidMove());

      let allCoords = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) allCoords.push(`${r}-${c}`);
      }
      renderBoard(allCoords);
    }

    // 🔀 셔플 팝업 띄우고 판 섞는 함수
    function triggerShuffleNoticeAndExecute(isAuto = false) {
      const modal = document.getElementById('shuffleNoticeModal');
      if (modal) modal.classList.add('active');

      setTimeout(() => {
        if (modal) modal.classList.remove('active');
        shuffleBoard();
      }, 1100);
    }

    function shuffleBoard() {
      selectedBlock = null;
      let values = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          values.push(gridData[r][c]);
        }
      }

      do {
        values.sort(() => Math.random() - 0.5);
        let idx = 0;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            gridData[r][c] = values[idx++];
          }
        }
      } while (!hasValidMove());

      let allCoords = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) allCoords.push(`${r}-${c}`);
      }
      renderBoard(allCoords);
    }

    shuffleBtn.onclick = () => shuffleBoard();

    function renderBoard(fallingCoords = []) {
      board.innerHTML = '';
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const val = gridData[r][c];
          const block = document.createElement('div');
          
          block.className = `num-block block-val-${val}`;
          block.innerText = val > 0 ? val : '';
          if (val === 0) block.style.visibility = 'hidden';

          if (selectedBlock && selectedBlock.r === r && selectedBlock.c === c) {
            block.classList.add('block-selected');
          }

          const key = `${r}-${c}`;
          if (fallingCoords.includes(key)) {
            block.classList.add('falling');
          }

          block.onclick = () => onBlockClick(r, c, val, block);
          board.appendChild(block);
        }
      }
    }

    function onBlockClick(r, c, val, blockEl) {
      if (val === 0) return;

      if (!selectedBlock) {
        selectedBlock = { r, c, val, el: blockEl };
        renderBoard();
      } else if (selectedBlock.r === r && selectedBlock.c === c) {
        selectedBlock = null;
        renderBoard();
      } else {
        const isAdjacent = (Math.abs(selectedBlock.r - r) + Math.abs(selectedBlock.c - c)) === 1;
        const sum = selectedBlock.val + val;

        if (isAdjacent && sum === 10) {
          score += 150;
          earnedGold += 15;
          document.getElementById('gameScore').innerText = score;
          document.getElementById('gameEarnedGold').innerText = earnedGold;

          gridData[selectedBlock.r][selectedBlock.c] = 0;
          gridData[r][c] = 0;
          selectedBlock = null;

          applyGravityAndRefill();
        } else {
          selectedBlock = null;
          blockEl.style.animation = 'bossShake 0.3s ease';
          setTimeout(renderBoard, 300);
        }
      }
    }

    function applyGravityAndRefill() {
      let fallingCoords = [];

      for (let c = 0; c < COLS; c++) {
        for (let r = ROWS - 1; r >= 0; r--) {
          if (gridData[r][c] === 0) {
            for (let k = r - 1; k >= 0; k--) {
              if (gridData[k][c] !== 0) {
                gridData[r][c] = gridData[k][c];
                gridData[k][c] = 0;
                fallingCoords.push(`${r}-${c}`);
                break;
              }
            }
          }
        }
        for (let r = 0; r < ROWS; r++) {
          if (gridData[r][c] === 0) {
            gridData[r][c] = Math.floor(Math.random() * 9) + 1;
            fallingCoords.push(`${r}-${c}`);
          }
        }
      }
      renderBoard(fallingCoords);

      // ★ [팝업 안내 후 자동 셔플 실행] ★
      if (!hasValidMove()) {
        setTimeout(() => {
          triggerShuffleNoticeAndExecute(true);
        }, 300);
      }
    }

    createBoard();

    return {
      name: '🧱 10 블럭 크러시',
      getScore: () => score,
      getEarnedGold: () => earnedGold
    };
  }

  // ----------------------------------------------------
  // MINI GAME 3: MATH RUSH 10 (25s)
  // ----------------------------------------------------
  function initMathGame() {
    const playArea = document.getElementById('playArea');
    playArea.innerHTML = `
      <div class="math-rush-container">
        <div id="equationBox" class="equation-box">? + 4 = 10</div>
        <div id="optionsGrid" class="options-grid"></div>
      </div>
    `;

    let score = 0;
    let earnedGold = 0;
    let combo = 0;
    let currentAns = 0;

    function nextQuiz() {
      const eqBox = document.getElementById('equationBox');
      const optGrid = document.getElementById('optionsGrid');
      optGrid.innerHTML = '';

      const type = Math.floor(Math.random() * 3);
      let a, b, ans;

      if (type === 0) {
        b = Math.floor(Math.random() * 9) + 1;
        ans = 10 - b;
        eqBox.innerText = `? + ${b} = 10`;
      } else if (type === 1) {
        a = Math.floor(Math.random() * 9) + 1;
        ans = 10 - a;
        eqBox.innerText = `${a} + ? = 10`;
      } else {
        b = Math.floor(Math.random() * 9) + 1;
        ans = 10 - b;
        eqBox.innerText = `10 - ? = ${b}`;
      }

      currentAns = ans;

      let options = [ans];
      while (options.length < 4) {
        let fake = Math.floor(Math.random() * 9) + 1;
        if (!options.includes(fake)) options.push(fake);
      }
      options.sort(() => Math.random() - 0.5);

      options.forEach(optVal => {
        const btn = document.createElement('button');
        btn.className = 'btn-option';
        btn.innerText = optVal;
        btn.onclick = () => submitAns(optVal);
        optGrid.appendChild(btn);
      });
    }

    function submitAns(val) {
      if (val === currentAns) {
        combo++;
        score += 100 + combo * 10;
        earnedGold += 10 + Math.floor(combo / 2);
        document.getElementById('gameScore').innerText = score;
        document.getElementById('gameEarnedGold').innerText = earnedGold;
      } else {
        combo = 0;
      }
      nextQuiz();
    }

    nextQuiz();

    return {
      name: '⚡ 10 수식 스피드 러시',
      getScore: () => score,
      getEarnedGold: () => earnedGold
    };
  }

  // ----------------------------------------------------
  // MINI GAME CONTROLLER
  // ----------------------------------------------------
  function startMiniGame(type) {
    document.getElementById('mainMenu').classList.remove('active');
    document.getElementById('gameScreen').classList.add('active');

    let timeLeft = 25;
    document.getElementById('gameTimer').innerText = timeLeft;
    document.getElementById('timerBar').style.width = '100%';
    document.getElementById('gameScore').innerText = '0';
    document.getElementById('gameEarnedGold').innerText = '0';

    if (type === 'connect') currentGame = initConnectGame();
    else if (type === 'block') currentGame = initBlockGame();
    else if (type === 'math') currentGame = initMathGame();

    document.getElementById('gameTitle').innerText = currentGame.name;

    timerInterval = setInterval(() => {
      timeLeft--;
      document.getElementById('gameTimer').innerText = timeLeft;
      document.getElementById('timerBar').style.width = `${(timeLeft / 25) * 100}%`;

      if (timeLeft <= 0) {
        endMiniGame();
      }
    }, 1000);
  }

  function endMiniGame() {
    clearInterval(timerInterval);
    clearInterval(gameInterval);

    const score = currentGame.getScore();
    const gold = currentGame.getEarnedGold();

    state.gold += gold;
    state.clearCount += 1;
    saveData();

    updateUserRankings();

    showResultModal('🎉 미니게임 클리어!', `${currentGame.name}을(를) 완료했습니다.`, [
      { label: '최종 점수', val: `${score} 점` },
      { label: '획득 골드', val: `+${gold} Gold` }
    ]);
  }

  function quitCurrentGame() {
    clearInterval(timerInterval);
    clearInterval(gameInterval);
    document.getElementById('gameScreen').classList.remove('active');
    document.getElementById('bossScreen').classList.remove('active');
    document.getElementById('mainMenu').classList.add('active');
  }

  // ----------------------------------------------------
  // BOSS RAID LOGIC
  // ----------------------------------------------------
  let bossStartTime = 0;
  let bossQuizIndex = 0;
  let bossQuizzes = [];
  let bossTimerHandler = null;

  function startBossRaid() {
    if (state.gold < 100) {
      alert('보스 레이드에 도전하려면 100 Gold가 필요합니다! 미니게임을 플레이하여 골드를 모아보세요.');
      return;
    }

    state.gold -= 100;
    saveData();

    document.getElementById('mainMenu').classList.remove('active');
    document.getElementById('bossScreen').classList.add('active');

    bossQuizzes = [];
    for (let i = 0; i < 10; i++) {
      bossQuizzes.push(generateBossQuiz());
    }

    bossQuizIndex = 0;
    renderBossQuiz();

    document.getElementById('bossHpBar').style.width = '100%';
    document.getElementById('bossHpText').innerText = '10';
    document.getElementById('bossTimer').innerText = '0.00';

    bossStartTime = performance.now();
    bossTimerHandler = setInterval(() => {
      const elapsed = (performance.now() - bossStartTime) / 1000;
      document.getElementById('bossTimer').innerText = elapsed.toFixed(2);
    }, 30);
  }

  function generateBossQuiz() {
    const type = Math.floor(Math.random() * 4);
    let qStr = '', ans = 0;

    if (type === 0) {
      let a = Math.floor(Math.random() * 4) + 1;
      let b = Math.floor(Math.random() * (9 - a)) + 1;
      ans = 10 - a - b;
      qStr = `${a} + ${b} + ? = 10`;
    } else if (type === 1) {
      let a = Math.floor(Math.random() * 5) + 1;
      let target = Math.floor(Math.random() * 3) + 1;
      ans = 10 - a - target;
      qStr = `10 - ${a} - ? = ${target}`;
    } else if (type === 2) {
      let b = Math.floor(Math.random() * 8) + 1;
      ans = 10 - b;
      qStr = `? + ${b} = 10`;
    } else {
      let target = Math.floor(Math.random() * 8) + 1;
      ans = 10 - target;
      qStr = `10 - ? = ${target}`;
    }

    let options = [ans];
    while (options.length < 4) {
      let fake = Math.floor(Math.random() * 9) + 1;
      if (!options.includes(fake)) options.push(fake);
    }
    options.sort(() => Math.random() - 0.5);

    return { qStr, ans, options };
  }

  function renderBossQuiz() {
    const qData = bossQuizzes[bossQuizIndex];
    document.getElementById('bossQuizStep').innerText = bossQuizIndex + 1;
    document.getElementById('bossQuizQuestion').innerText = qData.qStr;

    const optContainer = document.getElementById('bossQuizOptions');
    optContainer.innerHTML = '';

    qData.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'btn-option';
      btn.innerText = opt;
      btn.onclick = () => submitBossAns(opt, qData.ans);
      optContainer.appendChild(btn);
    });
  }

  function submitBossAns(val, correctAns) {
    if (val === correctAns) {
      triggerBossHit();
      bossQuizIndex++;
      const remain = 10 - bossQuizIndex;
      document.getElementById('bossHpText').innerText = remain;
      document.getElementById('bossHpBar').style.width = `${(remain / 10) * 100}%`;

      if (bossQuizIndex >= 10) {
        finishBossRaid();
      } else {
        renderBossQuiz();
      }
    } else {
      bossStartTime -= 1000;
      const dmg = document.getElementById('bossDamageFloat');
      dmg.innerText = '+1.00s 패널티!';
      dmg.style.color = '#ef4444';
      dmg.classList.add('show');
      setTimeout(() => dmg.classList.remove('show'), 600);
    }
  }

  function triggerBossHit() {
    const avatar = document.getElementById('bossAvatar');
    avatar.classList.add('shake');
    setTimeout(() => avatar.classList.remove('shake'), 400);

    const dmg = document.getElementById('bossDamageFloat');
    dmg.innerText = 'HIT!';
    dmg.style.color = '#f59e0b';
    dmg.classList.add('show');
    setTimeout(() => dmg.classList.remove('show'), 600);
  }

  function finishBossRaid() {
    clearInterval(bossTimerHandler);
    const totalTime = (performance.now() - bossStartTime) / 1000;
    const timeFormatted = totalTime.toFixed(2);

    let isNewRecord = false;
    if (!state.bestBossTime || totalTime < state.bestBossTime) {
      state.bestBossTime = totalTime;
      isNewRecord = true;
    }

    const bossRewardGold = 200;
    state.gold += bossRewardGold;
    state.clearCount += 1;
    saveData();

    updateUserRankings();

    showResultModal(
      '🏆 10의 마왕 퇴치 성공!',
      isNewRecord ? '🎉 최고 최단 클리어 신기록 달성!' : '보스를 물리치고 대량의 골드를 획득했습니다.',
      [
        { label: '소요 시간 (스피드런)', val: `${timeFormatted} 초` },
        { label: '클리어 보상', val: `+${bossRewardGold} Gold` }
      ]
    );
  }

  // ----------------------------------------------------
  // RESULT & MODAL CONTROLLERS
  // ----------------------------------------------------
  function showResultModal(title, desc, statsArray) {
    document.getElementById('resultTitle').innerText = title;
    document.getElementById('resultDesc').innerText = desc;

    const statsContainer = document.getElementById('resultStats');
    statsContainer.innerHTML = '';
    statsArray.forEach(item => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.innerHTML = `<span>${item.label}</span><strong>${item.val}</strong>`;
      statsContainer.appendChild(row);
    });

    document.getElementById('resultModal').classList.add('active');
  }

  function closeResultModal() {
    document.getElementById('resultModal').classList.remove('active');
    quitCurrentGame();
  }

  // ----------------------------------------------------
  // HALL OF FAME RANKING LOGIC
  // ----------------------------------------------------
  function updateUserRankings() {
    let rankings = getRankings();

    if (state.bestBossTime) {
      rankings.time = rankings.time.filter(r => r.nickname !== state.nickname);
      rankings.time.push({ nickname: state.nickname, value: parseFloat(state.bestBossTime.toFixed(2)) });
      rankings.time.sort((a, b) => a.value - b.value);
      rankings.time = rankings.time.slice(0, 10);
    }

    rankings.gold = rankings.gold.filter(r => r.nickname !== state.nickname);
    rankings.gold.push({ nickname: state.nickname, value: state.gold });
    rankings.gold.sort((a, b) => b.value - a.value);
    rankings.gold = rankings.gold.slice(0, 10);

    rankings.clear = rankings.clear.filter(r => r.nickname !== state.nickname);
    rankings.clear.push({ nickname: state.nickname, value: state.clearCount });
    rankings.clear.sort((a, b) => b.value - a.value);
    rankings.clear = rankings.clear.slice(0, 10);

    saveRankings(rankings);
  }

  async function openHallOfFame() {
    updateUserRankings();
    await renderHallTable(state.currentTab);
    document.getElementById('hallModal').classList.add('active');
  }

  function closeHallOfFame() {
    document.getElementById('hallModal').classList.remove('active');
  }

  async function switchHallTab(tabName) {
    state.currentTab = tabName;
    const btns = document.querySelectorAll('.hall-tabs .tab-btn');
    btns.forEach(b => b.classList.remove('active'));

    if (tabName === 'time') btns[0].classList.add('active');
    else if (tabName === 'gold') btns[1].classList.add('active');
    else if (tabName === 'clear') btns[2].classList.add('active');

    await renderHallTable(tabName);
  }

  async function renderHallTable(tabName) {
    let list = [];

    if (firebaseModule && firebaseModule.fetchTopRankingsFromFirestore) {
      const dbList = await firebaseModule.fetchTopRankingsFromFirestore(tabName);
      if (dbList && dbList.length > 0) {
        list = dbList;
      }
    }

    if (list.length === 0) {
      const rankings = getRankings();
      list = rankings[tabName] || [];
    }

    const tbody = document.getElementById('rankingListBody');
    const header = document.getElementById('rankingHeader');

    if (tabName === 'time') {
      header.innerHTML = `<th>순위</th><th>유저 닉네임</th><th>최단 클리어 시간</th>`;
    } else if (tabName === 'gold') {
      header.innerHTML = `<th>순위</th><th>유저 닉네임</th><th>보유 골드</th>`;
    } else {
      header.innerHTML = `<th>순위</th><th>유저 닉네임</th><th>미니게임 클리어 수</th>`;
    }

    tbody.innerHTML = '';
    list.forEach((item, index) => {
      const tr = document.createElement('tr');
      if (item.nickname === state.nickname) tr.style.background = 'rgba(99, 102, 241, 0.15)';

      let rankClass = `rank-${index + 1}`;
      let valStr = '';
      if (tabName === 'time') valStr = `⏱️ ${typeof item.value === 'number' ? item.value.toFixed(2) : item.value} 초`;
      else if (tabName === 'gold') valStr = `💰 ${typeof item.value === 'number' ? item.value.toLocaleString() : item.value} G`;
      else valStr = `🎖️ ${item.value} 회`;

      tr.innerHTML = `
        <td class="${rankClass}">${index + 1}위</td>
        <td style="font-weight: 700;">${item.nickname} ${item.nickname === state.nickname ? '(나)' : ''}</td>
        <td>${valStr}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function saveProfileNickname() {
    const input = document.getElementById('nicknameInput').value.trim();
    if (input) {
      state.nickname = input;
      saveData();
      updateUserRankings();
      closeAuthModal();
      alert(`닉네임이 '${input}'(으)로 변경되었습니다!`);
    }
  }

  // DOM Content Loaded Init
  document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initFirebaseModule();
  });

  const api = {
    openInstruction,
    closeInstruction,
    startMiniGame,
    quitCurrentGame,
    startBossRaid,
    closeResultModal,
    openHallOfFame,
    closeHallOfFame,
    switchHallTab,
    openAuthModal,
    closeAuthModal,
    handleGoogleLogin,
    handleAnonLogin,
    handleLogout,
    saveProfileNickname
  };

  return api;
})();

window.TenGame = TenGame;
