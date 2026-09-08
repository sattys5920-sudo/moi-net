const SCREENS = ['profile', 'chat', 'search', 'folder', 'internet', 'accuse'];
const TITLES = {
  profile: '내 프로필',
  chat: 'moi.net',
  search: '검색',
  folder: '단서 수첩',
  internet: '인터넷 브라우저',
  accuse: '최종 추리',
};

const desktopView = document.getElementById('view-desktop');
const taskappArea = document.getElementById('taskapp-area');

function openScreen(name) {
  desktopView.classList.add('hidden');
  SCREENS.forEach((s) => {
    document.getElementById('view-' + s).classList.toggle('hidden', s !== name);
  });
  taskappArea.innerHTML = '';
  const label = document.createElement('div');
  label.className = 'taskapp';
  label.textContent = TITLES[name];
  taskappArea.appendChild(label);
  if (name === 'chat') renderRoster();
  if (name === 'folder') openNotebook();
  if (name === 'accuse') renderAccuse();
}

function closeToDesktop() {
  SCREENS.forEach((s) => document.getElementById('view-' + s).classList.add('hidden'));
  desktopView.classList.remove('hidden');
  taskappArea.innerHTML = '';
}

document.querySelectorAll('[data-open]').forEach((el) => {
  el.addEventListener('click', () => openScreen(el.dataset.open));
});
document.querySelectorAll('[data-close]').forEach((el) => {
  el.addEventListener('click', closeToDesktop);
});

// ===== LAST LOG : 게임 상태 =====
const ROSTER = ['모카', '잭', '유령', '복숭아', '레몬', '검은고양이'];
const API_URL = '/api/gameChat';

const DAY_INTRO = {
  1: '실종 첫날. 라임이 사라졌다는 사실만 확인된 상태다.',
  2: 'DAY 2. 라임 계정이 실종 이후에도 움직였다는 소문이 돈다.',
  3: 'DAY 3. 사람마다 다른 정보를 들었다는 이야기가 나오기 시작한다.',
  4: 'DAY 4. 숨겨왔던 사실들이 하나씩 드러날 조짐이 보인다.',
  5: 'DAY 5. 라임의 마지막 흔적을 정리할 시간이다.',
};

function loadState() {
  try {
    const raw = localStorage.getItem('lastlog-state');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

function saveState() {
  try {
    localStorage.setItem(
      'lastlog-state',
      JSON.stringify({ day: state.day, nickname: state.nickname, threads: state.threads })
    );
  } catch (e) {}
}

const saved = loadState();
const state = saved || {
  day: 1,
  nickname: null,
  currentView: 'group',
  threads: {
    group: { history: [], trust: 0 },
    모카: { history: [], trust: 0 },
    잭: { history: [], trust: 0 },
    유령: { history: [], trust: 0 },
    복숭아: { history: [], trust: 0 },
    레몬: { history: [], trust: 0 },
    검은고양이: { history: [], trust: 0 },
  },
};
state.currentView = 'group';

const chatLog = document.getElementById('chat-log');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const rosterEl = document.getElementById('roster');
const dayTag = document.getElementById('day-tag');

const OTHER_AVATAR_SVG =
  '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="6" r="3" fill="#f2c48a"/><path d="M2 15c1-4 4-5 6-5s5 1 6 5" fill="#3b6fa8"/></svg>';

function addMessage(from, text, name) {
  const row = document.createElement('div');
  row.className = from === 'me' ? 'msgrow mine' : 'msgrow';

  const avatar = document.createElement('div');
  if (from === 'me') {
    avatar.className = 'avatar-me';
    avatar.textContent = '나';
  } else {
    avatar.className = 'avatar-other';
    avatar.innerHTML = OTHER_AVATAR_SVG;
  }

  const bubbleWrap = document.createElement('div');
  bubbleWrap.style.display = 'flex';
  bubbleWrap.style.flexDirection = 'column';
  bubbleWrap.style.gap = '2px';
  bubbleWrap.style.alignItems = from === 'me' ? 'flex-end' : 'flex-start';

  if (from !== 'me' && name) {
    const nameTag = document.createElement('div');
    nameTag.style.fontSize = '10px';
    nameTag.style.color = '#555';
    nameTag.style.fontWeight = '700';
    nameTag.textContent = name;
    bubbleWrap.appendChild(nameTag);
  }

  const bubble = document.createElement('div');
  bubble.className = from === 'me' ? 'bubble-out' : 'bubble-in';
  bubble.textContent = text;
  bubbleWrap.appendChild(bubble);

  row.appendChild(avatar);
  row.appendChild(bubbleWrap);
  chatLog.appendChild(row);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function addSysLine(text) {
  const line = document.createElement('div');
  line.className = 'sys-line';
  line.textContent = text;
  chatLog.appendChild(line);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function addLoadingLine() {
  const line = document.createElement('div');
  line.className = 'loading-line';
  line.id = 'loading-line';
  line.textContent = '...(응답 기다리는 중)';
  chatLog.appendChild(line);
  chatLog.scrollTop = chatLog.scrollHeight;
  return line;
}

function renderRoster() {
  rosterEl.innerHTML = '';
  const groupBtn = document.createElement('div');
  groupBtn.className = 'roster-btn' + (state.currentView === 'group' ? ' active' : '');
  groupBtn.textContent = '그룹채팅';
  groupBtn.addEventListener('click', () => switchView('group'));
  rosterEl.appendChild(groupBtn);

  ROSTER.forEach((name) => {
    const btn = document.createElement('div');
    btn.className = 'roster-btn' + (state.currentView === name ? ' active' : '');
    btn.textContent = name;
    btn.addEventListener('click', () => switchView(name));
    rosterEl.appendChild(btn);
  });
  dayTag.textContent = 'DAY ' + state.day;
}

function switchView(view) {
  state.currentView = view;
  renderRoster();
  chatLog.innerHTML = '';
  if (view === 'group') {
    addSysLine('[새벽 2시 그룹채팅방]');
  } else {
    addSysLine('[' + view + ' 접속 중...]');
  }
  const th = state.threads[view];
  th.history.forEach((m) => {
    if (m.role === 'user') addMessage('me', m.content);
    else renderAssistantMessage(view, m.content);
  });
}

function renderAssistantMessage(view, text) {
  if (view === 'group') {
    text.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const m = trimmed.match(/^([^:：]{1,10})[:：]\s*(.+)$/);
      if (m) addMessage('other', m[2], m[1]);
      else addSysLine(trimmed);
    });
  } else {
    addMessage('other', text, view);
  }
}

async function callAPI(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('API error ' + res.status);
  const data = await res.json();
  return data.reply;
}

function transcriptDump() {
  const parts = [];
  const g = state.threads.group.history;
  if (g.length) {
    parts.push('[그룹채팅방 기록]');
    g.forEach((m) => parts.push((m.role === 'user' ? state.nickname + ': ' : '') + m.content));
  }
  ROSTER.forEach((name) => {
    const h = state.threads[name].history;
    if (h.length) {
      parts.push('[' + name + '와의 개인채팅 기록]');
      h.forEach((m) => parts.push((m.role === 'user' ? state.nickname + ': ' : name + ': ') + m.content));
    }
  });
  return parts.join('\n');
}

function showIntro() {
  chatLog.innerHTML = '';
  addSysLine('새벽 2시 채팅방에 입장했습니다. 현재 접속자 13명.');
  ROSTER.concat(['라임']).forEach((n) => addSysLine(n));
  addSysLine('그리고 당신.');
  addSysLine('23:58 모카: "라임?"');
  addSysLine('00:01 잭: "아직 안 왔는데?"');
  addSysLine('00:03 복숭아: "오늘 아예 안 오는 거 아님?"');
  addSysLine('00:05 모카: "얘 원래 이 시간엔 꼭 오는데."');
  addSysLine('[라임님의 마지막 접속: 18시간 전]');
}

function ensureNickname() {
  if (state.nickname) return false;
  let nick = '';
  while (!nick) {
    nick = (window.prompt('닉네임을 입력하세요 (새벽 2시 채팅방에서 쓸 이름):') || '').trim();
  }
  state.nickname = nick;
  saveState();
  return true;
}

async function handleSend() {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';

  if (text === '오늘은 여기까지') {
    if (state.day < 5) state.day++;
    switchView(state.currentView);
    addSysLine('=== DAY ' + state.day + ' ===');
    addSysLine(DAY_INTRO[state.day] || '');
    saveState();
    return;
  }

  if (ROSTER.includes(text)) {
    switchView(text);
    return;
  }
  if (text === '그룹채팅' || text === '그룹') {
    switchView('group');
    return;
  }

  addMessage('me', text);

  let mode = state.currentView === 'group' ? 'group' : 'dm';
  let npcId = state.currentView === 'group' ? undefined : state.currentView;
  let apiInput = text;
  let useThreadHistory = true;

  if (/^검색\s*/.test(text)) {
    mode = 'search';
    apiInput = text.replace(/^검색\s*/, '');
    useThreadHistory = false;
  } else if (text === '정리해줘') {
    mode = 'summary';
    apiInput = '[전체 기록]\n' + transcriptDump() + '\n\n플레이어 명령: 정리해줘';
    useThreadHistory = false;
  } else if (text === '힌트') {
    mode = 'hint';
    useThreadHistory = false;
  }

  const loadingEl = addLoadingLine();
  try {
    const thread = useThreadHistory ? state.threads[state.currentView] : null;
    const reply = await callAPI({
      mode,
      day: state.day,
      npcId,
      trust: thread ? thread.trust : undefined,
      history: thread ? thread.history : [],
      playerInput: apiInput,
    });
    loadingEl.remove();

    if (useThreadHistory) {
      thread.history.push({ role: 'user', content: text });
      thread.history.push({ role: 'assistant', content: reply });
      thread.trust = Math.min(10, thread.trust + 1);
      renderAssistantMessage(state.currentView, reply);
    } else {
      addMessage('other', reply, mode === 'search' ? '검색결과' : mode === 'summary' ? '정리' : '힌트');
    }
    saveState();
  } catch (e) {
    loadingEl.remove();
    addSysLine('(오류: 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.)');
    console.error(e);
  }
}

chatSend.addEventListener('click', handleSend);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSend();
});

// ===== 검색 앱 (moi.net과 별개 진입점, 같은 백엔드 사용) =====
const searchInput = document.getElementById('search-input');
const searchGo = document.getElementById('search-go');
const searchResults = document.getElementById('search-results');

async function runSearch() {
  const q = searchInput.value.trim();
  if (!q) return;
  searchResults.innerHTML = '';
  const loading = document.createElement('div');
  loading.className = 'loading-line';
  loading.textContent = '검색 중...';
  searchResults.appendChild(loading);
  try {
    const reply = await callAPI({ mode: 'search', day: state.day, history: [], playerInput: q });
    loading.remove();
    const box = document.createElement('div');
    box.className = 'clue-body';
    box.style.whiteSpace = 'pre-line';
    box.textContent = reply;
    searchResults.appendChild(box);
  } catch (e) {
    loading.remove();
    const err = document.createElement('div');
    err.className = 'clue-empty';
    err.textContent = '검색 서버에 연결할 수 없습니다.';
    searchResults.appendChild(err);
  }
}
searchGo.addEventListener('click', runSearch);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runSearch();
});

// ===== 단서 수첩 (전체 기록 기반 자동 요약) =====
async function openNotebook() {
  const list = document.getElementById('notebook-list');
  list.innerHTML = '';
  const dump = transcriptDump();
  if (!dump) {
    const empty = document.createElement('div');
    empty.className = 'clue-empty';
    empty.textContent = '아직 대화한 내용이 없습니다. moi.net에서 조사를 시작하세요.';
    list.appendChild(empty);
    return;
  }
  const loading = document.createElement('div');
  loading.className = 'loading-line';
  loading.textContent = '지금까지의 기록을 정리하는 중...';
  list.appendChild(loading);
  try {
    const reply = await callAPI({
      mode: 'summary',
      day: state.day,
      history: [],
      playerInput: '[전체 기록]\n' + dump + '\n\n플레이어 명령: 정리해줘',
    });
    loading.remove();
    const box = document.createElement('div');
    box.className = 'clue-body';
    box.style.whiteSpace = 'pre-line';
    box.textContent = reply;
    list.appendChild(box);
  } catch (e) {
    loading.remove();
    list.innerHTML = '<div class="clue-empty">수첩을 불러오지 못했습니다.</div>';
  }
}

// ===== 최종 추리 =====
const FINAL_QUESTIONS = [
  '1. 라임은 왜 사라졌는가?',
  '2. 누가 라임의 개인정보를 유출했는가?',
  '3. 라임 계정을 사용한 사람은 누구인가?',
  '4. 6명의 용의자들은 왜 거짓말했는가?',
  '5. 실종 당일 실제로 무슨 일이 있었는가?',
];

function renderAccuse() {
  const body = document.getElementById('accuse-body');
  body.innerHTML = '';

  const info = document.createElement('div');
  info.style.marginBottom = '10px';
  info.style.color = '#555';
  info.textContent = '지금까지의 조사 내용을 바탕으로 답해주세요. (DAY ' + state.day + ')';
  body.appendChild(info);

  const textareas = [];
  FINAL_QUESTIONS.forEach((q) => {
    const group = document.createElement('div');
    group.className = 'qgroup';
    const title = document.createElement('div');
    title.className = 'qgroup-title';
    title.textContent = q;
    const ta = document.createElement('textarea');
    ta.className = 'qtext';
    group.appendChild(title);
    group.appendChild(ta);
    body.appendChild(group);
    textareas.push(ta);
  });

  const submitBtn = document.createElement('div');
  submitBtn.className = 'toolbtn accuse-submit';
  submitBtn.style.width = '120px';
  submitBtn.style.fontWeight = '700';
  submitBtn.textContent = '추리 제출하기';
  body.appendChild(submitBtn);

  const resultBox = document.createElement('div');
  resultBox.id = 'accuse-result';
  body.appendChild(resultBox);

  submitBtn.addEventListener('click', async () => {
    const answers = textareas.map((t) => t.value.trim());
    if (answers.some((a) => !a)) {
      resultBox.className = 'accuse-result';
      resultBox.textContent = '5가지 질문에 모두 답해주세요.';
      return;
    }
    resultBox.className = 'loading-line';
    resultBox.textContent = '추리를 채점하는 중...';
    const combined = FINAL_QUESTIONS.map((q, i) => q + '\n답: ' + answers[i]).join('\n\n');
    try {
      const reply = await callAPI({
        mode: 'final',
        day: state.day,
        history: [],
        playerInput: '[전체 기록]\n' + transcriptDump() + '\n\n[플레이어의 최종 추리]\n' + combined,
      });
      resultBox.className = 'accuse-result';
      resultBox.textContent = reply;
    } catch (e) {
      resultBox.className = 'accuse-result';
      resultBox.textContent = '채점 서버에 연결할 수 없습니다.';
    }
  });
}

// ===== 초기화 =====
document.querySelector('[data-open="chat"]').addEventListener('click', () => {
  const isFirstTime = ensureNickname();
  if (isFirstTime) {
    renderRoster();
    showIntro();
  } else {
    switchView(state.currentView);
  }
});

// ===== 화면 크기에 맞춰 축소 =====
const bezel = document.getElementById('bezel');
function fitStage() {
  const margin = 40;
  const scale = Math.min(1, (window.innerWidth - margin) / 460, (window.innerHeight - margin) / 560);
  bezel.style.transform = 'scale(' + scale + ')';
}
window.addEventListener('resize', fitStage);
fitStage();
