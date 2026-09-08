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
  if (name === 'folder') renderNotebook();
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

// ===== 키워드 매칭 (부분 입력 허용, 다단어 키워드는 정확히 포함되어야 함) =====
function norm(s) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function matchesQuery(keywords, q) {
  const nq = norm(q);
  if (!nq) return false;
  return keywords.some((k) => {
    const nk = norm(k);
    if (nq.includes(nk)) return true;
    if (!nk.includes(' ') && nk.includes(nq)) return true;
    return false;
  });
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ===== 게임 상태 =====
const DAY_HINTS = {
  1: '사람들의 말투 차이에 주목해보세요.',
  2: '데미안 계정이 실종 이후에도 움직였다는 점을 검색해보세요.',
  3: '모두에게 같은 질문을 던져보고 반응을 비교해보세요.',
  4: '신뢰를 쌓은 뒤 "진짜 이유"를 물어보세요.',
  5: '지금까지 알아낸 것을 최종 추리에서 정리해보세요.',
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
      JSON.stringify({
        day: state.day,
        nickname: state.nickname,
        currentView: state.currentView,
        threads: state.threads,
        unlocked: state.unlocked,
      })
    );
  } catch (e) {}
}

function freshThreads() {
  const t = { group: { history: [] } };
  ROSTER.forEach((n) => {
    t[n] = { history: [] };
  });
  return t;
}

const saved = loadState();
const state =
  saved || {
    day: 1,
    nickname: null,
    currentView: 'group',
    threads: freshThreads(),
    unlocked: [],
  };

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

function renderHistoryEntry(e) {
  if (e.type === 'sys') addSysLine(e.text);
  else if (e.type === 'me') addMessage('me', e.text);
  else addMessage('other', e.text, e.speaker);
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
    addSysLine('[새벽 2 시 그룹채팅방]');
  } else {
    addSysLine('[' + view + ' 접속 중...]');
  }
  state.threads[view].history.forEach(renderHistoryEntry);
  saveState();
}

function showIntro() {
  chatLog.innerHTML = '';
  addSysLine('새벽 2 시 채팅방에 입장했습니다. 현재 접속자 13 명.');
  ROSTER.concat(['데미안']).forEach((n) => addSysLine(n));
  addSysLine('그리고 당신.');
  addSysLine('23:58 고니: "데미안?"');
  addSysLine('00:01 계룡맛: "아직 안 왔는데?"');
  addSysLine('00:03 wkwkdfoq: "오늘 아예 안 오는 거 아님?"');
  addSysLine('00:05 고니: "얘 원래 이 시간엔 꼭 오는데."');
  addSysLine('[데미안님의 마지막 접속: 18 시간 전]');
}

function ensureNickname() {
  if (state.nickname) return false;
  let nick = '';
  while (!nick) {
    nick = (window.prompt('닉네임을 입력하세요 (새벽 2 시 채팅방에서 쓸 이름):') || '').trim();
  }
  state.nickname = nick;
  saveState();
  return true;
}

function unlockClue(id, title, body, day) {
  if (state.unlocked.some((c) => c.id === id)) return false;
  state.unlocked.push({ id, title, body, day });
  return true;
}

function advanceDay() {
  if (state.day < 5) state.day++;
  const intro = DAY_INTRO[state.day];
  const entries = [{ type: 'sys', text: '=== DAY ' + state.day + ' ===' }, { type: 'sys', text: intro.sys }];
  (intro.lines || []).forEach((l) => entries.push({ type: 'npc', text: l.text, speaker: l.speaker }));
  state.threads.group.history.push(...entries);
  if (state.currentView === 'group') entries.forEach(renderHistoryEntry);
  renderRoster();
  saveState();
}

// 신뢰도 = 이 NPC에게서 이미 알아낸 서로 다른 사실의 개수 (스팸으로 늘릴 수 없음)
function trustFor(npc) {
  const prefix = npc + '_d';
  return state.unlocked.filter((c) => c.id.startsWith(prefix)).length;
}

function findNpcDialogue(npc, text) {
  const trust = trustFor(npc);
  const list = NPC_DIALOGUE[npc] || [];
  let best = null;
  for (const entry of list) {
    if (entry.day > state.day) continue;
    if ((entry.trustMin || 0) > trust) continue;
    if (!matchesQuery(entry.keywords, text)) continue;
    if (!best || entry.day > best.day || (entry.day === best.day && (entry.trustMin || 0) > (best.trustMin || 0))) {
      best = entry;
    }
  }
  return best;
}

function runSearchQuery(q) {
  return SEARCH_CLUES.filter((c) => c.day <= state.day && matchesQuery(c.keywords, q));
}

function handleSend() {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';

  if (text === '오늘은 여기까지') {
    advanceDay();
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

  if (state.currentView === 'group') {
    state.threads.group.history.push({ type: 'me', text });
    const reaction = pickRandom(GROUP_DEFAULT_LINES);
    state.threads.group.history.push({ type: 'npc', text: reaction.text, speaker: reaction.speaker });
    addMessage('other', reaction.text, reaction.speaker);
    saveState();
    return;
  }

  const npc = state.currentView;
  const thread = state.threads[npc];
  thread.history.push({ type: 'me', text });

  if (/^검색\s*/.test(text)) {
    const q = text.replace(/^검색\s*/, '');
    const results = runSearchQuery(q);
    let reply;
    if (results.length) {
      results.forEach((r) => unlockClue(r.id, r.title, r.body, r.day));
      reply = results.map((r) => r.title + ' — ' + r.body).join('\n');
    } else {
      reply = SEARCH_DEFAULT;
    }
    thread.history.push({ type: 'npc', text: reply, speaker: '검색결과' });
    addMessage('other', reply, '검색결과');
    saveState();
    return;
  }

  if (text === '힌트') {
    const reply = DAY_HINTS[state.day] || DAY_HINTS[1];
    thread.history.push({ type: 'npc', text: reply, speaker: '힌트' });
    addMessage('other', reply, '힌트');
    saveState();
    return;
  }

  if (text === '정리해줘') {
    const reply = state.unlocked.length
      ? state.unlocked.map((c) => '· ' + c.title + ': ' + c.body).join('\n')
      : '아직 알아낸 단서가 없습니다.';
    thread.history.push({ type: 'npc', text: reply, speaker: '정리' });
    addMessage('other', reply, '정리');
    saveState();
    return;
  }

  const found = findNpcDialogue(npc, text);
  let replyText;
  if (found) {
    replyText = found.body;
    unlockClue(found.id, found.title, found.body, found.day);
  } else {
    replyText = pickRandom(NPC_DEFAULT_LINES);
  }
  thread.history.push({ type: 'npc', text: replyText });
  addMessage('other', replyText, npc);
  saveState();
}

chatSend.addEventListener('click', handleSend);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSend();
});

// ===== 검색 앱 =====
const searchInput = document.getElementById('search-input');
const searchGo = document.getElementById('search-go');
const searchResults = document.getElementById('search-results');

function renderSearchResults(results) {
  searchResults.innerHTML = '';
  if (!results.length) {
    const empty = document.createElement('div');
    empty.className = 'clue-empty';
    empty.textContent = SEARCH_DEFAULT;
    searchResults.appendChild(empty);
    return;
  }
  results.forEach((r) => {
    const card = document.createElement('div');
    card.className = 'clue-card';
    const title = document.createElement('div');
    title.className = 'clue-title';
    title.textContent = r.title;
    const body = document.createElement('div');
    body.className = 'clue-body';
    body.textContent = r.body;
    card.appendChild(title);
    card.appendChild(body);
    searchResults.appendChild(card);
  });
}

function runSearch() {
  const q = searchInput.value.trim();
  if (!q) return;
  const results = runSearchQuery(q);
  results.forEach((r) => unlockClue(r.id, r.title, r.body, r.day));
  saveState();
  renderSearchResults(results);
}
searchGo.addEventListener('click', runSearch);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runSearch();
});

// ===== 단서 수첩 =====
function renderNotebook() {
  const list = document.getElementById('notebook-list');
  list.innerHTML = '';
  if (!state.unlocked.length) {
    const empty = document.createElement('div');
    empty.className = 'clue-empty';
    empty.textContent = '아직 알아낸 단서가 없습니다. moi.net과 검색에서 조사를 시작하세요.';
    list.appendChild(empty);
    return;
  }
  state.unlocked
    .slice()
    .sort((a, b) => a.day - b.day)
    .forEach((c) => {
      const card = document.createElement('div');
      card.className = 'clue-card';
      const title = document.createElement('div');
      title.className = 'clue-title';
      title.textContent = 'DAY ' + c.day + ' · ' + c.title;
      const body = document.createElement('div');
      body.className = 'clue-body';
      body.textContent = c.body;
      card.appendChild(title);
      card.appendChild(body);
      list.appendChild(card);
    });
}

// ===== 최종 추리 =====
function renderAccuse() {
  const body = document.getElementById('accuse-body');
  body.innerHTML = '';

  const info = document.createElement('div');
  info.style.marginBottom = '10px';
  info.style.color = '#555';
  info.textContent = '지금까지의 조사 내용을 바탕으로 답해주세요. (DAY ' + state.day + ')';
  body.appendChild(info);

  const selections = new Array(FINAL_QUESTIONS.length).fill(-1);

  FINAL_QUESTIONS.forEach((q, qi) => {
    const group = document.createElement('div');
    group.className = 'qgroup';
    const title = document.createElement('div');
    title.className = 'qgroup-title';
    title.textContent = q.q;
    group.appendChild(title);

    q.options.forEach((opt, oi) => {
      const label = document.createElement('label');
      label.className = 'qoption';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'q' + qi;
      radio.addEventListener('change', () => {
        selections[qi] = oi;
      });
      label.appendChild(radio);
      label.appendChild(document.createTextNode(opt));
      group.appendChild(label);
    });

    body.appendChild(group);
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

  submitBtn.addEventListener('click', () => {
    if (selections.some((s) => s === -1)) {
      resultBox.className = 'accuse-result';
      resultBox.textContent = '5 가지 질문에 모두 답해주세요.';
      return;
    }
    const score = selections.filter((s, i) => s === FINAL_QUESTIONS[i].correct).length;
    let verdict;
    if (score === 5) verdict = '완벽한 진실에 도달했습니다.';
    else if (score >= 3) verdict = '거의 다 왔습니다. 큰 흐름은 맞지만 세부 사항을 놓쳤습니다.';
    else verdict = '아직 사건의 실체에 닿지 못했습니다.';

    resultBox.className = 'accuse-result';
    resultBox.textContent = verdict + ' (' + score + '/5)\n\n[진실]\n' + TRUE_STORY_TEXT;
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
