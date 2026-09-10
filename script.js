// ===== LAST LOG : 마지막 접속 — 협동 라이브 추리 (최대 12 명) =====
// 각자 NPC를 따로 취조하지만, 알아낸 단서·수첩·추리 보드·그룹채팅은 방 전체가 실시간으로 공유한다.

const SCREENS = ['profile', 'chat', 'search', 'folder', 'chatlog', 'board', 'internet', 'accuse'];
const TITLES = {
  profile: '내 프로필',
  chat: 'moi.net',
  search: '검색',
  folder: '단서 수첩',
  chatlog: '대화 기록',
  board: '추리 보드',
  internet: '인터넷 브라우저',
  accuse: '최종 추리',
};
const MAX_PLAYERS = 12;

const desktopView = document.getElementById('view-desktop');
const lobbyView = document.getElementById('view-lobby');
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
  if (name === 'chat') {
    renderRoster();
    switchView(state.currentView);
  }
  if (name === 'folder') renderNotebook();
  if (name === 'chatlog') renderChatLog(document.getElementById('chatlog-search').value);
  if (name === 'board') renderBoardScreen();
  if (name === 'accuse') renderAccuse();
}

function closeToDesktop() {
  SCREENS.forEach((s) => document.getElementById('view-' + s).classList.add('hidden'));
  document.getElementById('view-popup').classList.add('hidden');
  desktopView.classList.remove('hidden');
  taskappArea.innerHTML = '';
}

document.querySelectorAll('[data-open]').forEach((el) => {
  el.addEventListener('click', () => openScreen(el.dataset.open));
});
document.querySelectorAll('[data-close]').forEach((el) => {
  el.addEventListener('click', closeToDesktop);
});

// ===== 키워드 매칭 =====
function norm(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[?!.,~…"'“”]+/g, ' ')
    .replace(/[ㅋㅎㅠㅜ]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
function squash(s) {
  return norm(s).replace(/\s/g, '');
}
function keywordScore(keywords, q) {
  const nq = squash(q);
  if (!nq) return 0;
  let best = 0;
  keywords.forEach((k) => {
    const nk = squash(k);
    if (!nk) return;
    const spaced = norm(k);
    const single = !spaced.includes(' ');
    const hit = nq.includes(nk) || (single && nk.includes(nq));
    if (hit && spaced.length > best) best = spaced.length;
  });
  return best;
}
const CONTINUE_RE = /^(응|어|음|오|헐|그래서|계속|더|더 말해 ?줘|더 말해|자세히|그리고|그 ?다음|왜|진짜|그래|응응|ㅇㅇ|ㅇㅋ|근데|근데 왜|그런데|말해 ?줘|말해 ?봐|그래서 뭐|그리고 나서|또)$/;
const PROBE_RE = /(숨기|숨긴|숨겨|비밀 ?있|거짓말 ?하|거짓말 ?이|뭐 ?있지|수상|요즘 ?어땠|요즘 ?어때|이상한 ?거 ?없|할 ?말 ?없|말 ?안 ?한 ?거|솔직히 ?말)/;
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const DAY_HINTS = {
  1: '6 명을 나눠 맡아 "데미안"에 대해 물어보고, 검색 앱에서 "데미안"을 검색해 보세요. 알아낸 건 방 전체 수첩에 모입니다.',
  2: '검색에서 "재접속", "23:18", "23:07", "00:03"을 찾아 관련자에게 증거로 제시해 보세요. 검색 결과가 전부 사실은 아닙니다.',
  3: '"미끼 정보"를 검색한 뒤 6 명 각각에게 제시해 보세요. 사람마다 들은 이야기가 다릅니다.',
  4: '"저수지", "마지막 통화", "메모"를 검색하세요. 포청천은 이제 답하지 않습니다. 그가 남긴 것을 읽으세요. "23:52"는 호호19에게.',
  5: '"정보 유출 구조"와 "다음 표적"을 검색해 보세요. 예약 게시물이 올라오면 그 직후 그룹채팅을 지켜보세요.',
};
const HELP_LINES = [
  '명령어: 닉네임 입력 → 1:1 취조 | 새벽 2 시(그룹채팅) | 수사실 | 검색 ○○ | 대화기록 | 대화검색 ○○ | 증거 ○○ | 목표 | 힌트 | 정리해줘 | 방 정보 | 오늘은 여기까지(방장)',
  '"새벽 2 시"는 NPC가 듣는 방입니다. "수사실"은 플레이어끼리만 쓰는 방입니다 — 누구를 의심하는지는 수사실에서.',
  '"대화기록"을 입력하거나 바탕화면의 "대화 기록"을 열면, 지금까지 나온 대사를 전부 다시 보거나 키워드로 검색할 수 있습니다.',
  '1:1 취조에서 알아낸 건 방 전체 수첩에 바로 공유됩니다. 아래 "증거 제시" 메뉴로 수첩의 단서를 상대에게 보여 줄 수 있습니다.',
  '바탕화면의 "추리 보드"는 방 전체가 함께 채웁니다. 오늘 보드를 다 잠그면 방장이 다음 날로 넘길 수 있습니다.',
];

// ===== 내 정보 / 방 =====
function loadJSON(key, fallback, storage) {
  try {
    const raw = (storage || localStorage).getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return fallback;
}
function saveJSON(key, val, storage) {
  try {
    (storage || localStorage).setItem(key, JSON.stringify(val));
  } catch (e) {}
}

// 플레이어 id와 현재 방은 탭 단위(sessionStorage): 탭을 하나 더 열면 다른 플레이어가 된다. 닉네임은 브라우저에 기억.
const me = { pid: loadJSON('lastlog-pid', null, sessionStorage) || 'p' + Math.random().toString(36).slice(2, 10), name: loadJSON('lastlog-name', '') };
saveJSON('lastlog-pid', me.pid, sessionStorage);

const room = { code: null, meta: null, players: {}, unlocked: {}, boards: {}, events: {}, presented: {}, chat: {}, private: {}, reacted: {}, leak: null, verdict: null };
// 채팅 방 두 개: 'group' = 새벽 2 시(NPC가 듣는다) / 'private' = 수사실(플레이어만)
const ROOM_VIEWS = ['group', 'private'];
function isRoomView(v) { return ROOM_VIEWS.includes(v); }
function npcGone(npc) { return npc === '포청천' && state.day >= 4; }
const unsubs = [];

// 기존 로직이 쓰던 형태의 로컬 미러 (공유 데이터 + 나만의 취조 기록)
const state = {
  day: 1,
  nickname: '',
  currentView: 'group',
  threads: {},
  unlocked: [],
  presented: [],
  events: [],
  boards: {},
};

function rp(sub) {
  return 'rooms/' + room.code + (sub ? '/' + sub : '');
}
function freshThreads() {
  const t = { group: { history: [] } };
  ROSTER.forEach((n) => (t[n] = { history: [] }));
  return t;
}
function dmKey() {
  return 'lastlog-dm-' + room.code + '-' + me.pid;
}
function saveThreads() {
  saveJSON(dmKey(), state.threads);
}

function has(id) {
  return state.unlocked.some((c) => c.id === id);
}
function countPrefix(prefix) {
  return state.unlocked.filter((c) => c.id.startsWith(prefix)).length;
}
function trustFor(npc) {
  return countPrefix(npc + '_');
}
function isHost() {
  return room.meta && room.meta.hostId === me.pid;
}
function hostOnline() {
  const h = room.meta && room.players[room.meta.hostId];
  return h && Date.now() - (h.lastSeen || 0) < 120000;
}
function onlinePlayers() {
  return Object.entries(room.players || {})
    .filter(([, p]) => Date.now() - (p.lastSeen || 0) < 90000)
    .map(([pid, p]) => ({ pid, name: p.name }));
}

// ===== 가짜 단서 =====
function clueDef(id) {
  return SEARCH_CLUES.find((c) => c.id === id);
}
function isRefuted(def) {
  return !!(def && def.fake && def.refutedBy.some(has));
}
function refutationTitles(def) {
  return def.refutedBy.filter(has).map((id) => (state.unlocked.find((c) => c.id === id) || {}).title).filter(Boolean);
}
function fakeStats() {
  const found = state.unlocked.map((u) => clueDef(u.id)).filter((d) => d && d.fake);
  return { found, refuted: found.filter(isRefuted) };
}

// ===== 채팅 DOM =====
const chatLog = document.getElementById('chat-log');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const rosterEl = document.getElementById('roster');
const dayTag = document.getElementById('day-tag');
const roomTag = document.getElementById('room-tag');
const evidenceRow = document.getElementById('evidence-row');
const evidenceSelect = document.getElementById('evidence-select');
const evidenceGo = document.getElementById('evidence-go');

const OTHER_AVATAR_SVG =
  '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="6" r="3" fill="#f2c48a"/><path d="M2 15c1-4 4-5 6-5s5 1 6 5" fill="#3b6fa8"/></svg>';

function addMessage(from, text, name, isPlayer) {
  const row = document.createElement('div');
  row.className = from === 'me' ? 'msgrow mine' : 'msgrow';
  const avatar = document.createElement('div');
  if (from === 'me') {
    avatar.className = 'avatar-me';
    avatar.textContent = '나';
  } else {
    avatar.className = 'avatar-other' + (isPlayer ? ' avatar-player' : '');
    avatar.innerHTML = isPlayer ? '' : OTHER_AVATAR_SVG;
    if (isPlayer) avatar.textContent = (name || '?').slice(0, 1);
  }
  const wrap = document.createElement('div');
  wrap.className = 'msgwrap';
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '2px';
  wrap.style.alignItems = from === 'me' ? 'flex-end' : 'flex-start';
  if (from !== 'me' && name) {
    const tag = document.createElement('div');
    tag.className = 'name-tag' + (isPlayer ? ' name-player' : '');
    tag.textContent = name;
    wrap.appendChild(tag);
  }
  const bubble = document.createElement('div');
  bubble.className = from === 'me' ? 'bubble-out' : isPlayer ? 'bubble-in bubble-player' : 'bubble-in';
  bubble.textContent = text;
  wrap.appendChild(bubble);
  row.appendChild(avatar);
  row.appendChild(wrap);
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
function renderEntry(e) {
  if (e.type === 'sys') addSysLine(e.text);
  else if (e.type === 'link') {
    const mine = e.pid === me.pid;
    addMessage(mine ? 'me' : 'other', '🔗 ' + e.text, e.from, true);
    const last = chatLog.lastElementChild;
    const bubble = last && last.querySelector('.bubble-out, .bubble-in');
    if (bubble) {
      bubble.classList.add('link-bubble');
      bubble.title = e.url || '';
      bubble.addEventListener('click', () => openPopupById(e.clueId));
    }
  } else if (e.type === 'me') {
    if (e.pid === me.pid || !e.pid) addMessage('me', e.text);
    else addMessage('other', e.text, e.from, true);
  } else addMessage('other', e.text, e.speaker);
}

// ----- 그룹채팅(공유) -----
let renderedChatKeys = new Set();
function chatEntries(view) {
  const src = (view === 'private' ? room.private : room.chat) || {};
  return Object.keys(src)
    .sort()
    .map((k) => ({ key: k, ...src[k] }));
}
const ROOM_HEADERS = {
  group: (code) => '[새벽 2 시 — 방 코드 ' + code + ' · NPC가 듣는 방. 여기서 한 말은 새어 나갈 수 있다]',
  private: () => '[수사실 — 플레이어 전용. NPC는 이 방을 볼 수 없다. 누구를 의심하는지는 여기서]',
};
function renderGroupChat(full) {
  const view = state.currentView;
  if (!isRoomView(view)) return;
  if (full) {
    chatLog.innerHTML = '';
    renderedChatKeys = new Set();
    addSysLine(ROOM_HEADERS[view](room.code));
  }
  chatEntries(view).forEach((e) => {
    if (renderedChatKeys.has(e.key)) return;
    renderedChatKeys.add(e.key);
    renderEntry(e);
  });
}
async function postChat(entry) {
  return Store.push(rp('chat'), { t: Date.now(), ...entry });
}
async function postPrivate(entry) {
  return Store.push(rp('private'), { t: Date.now(), ...entry });
}
function postToView(view, entry) {
  return view === 'private' ? postPrivate(entry) : postChat(entry);
}
function postSys(text) {
  return postChat({ type: 'sys', text });
}
// 여러 줄을 채팅처럼 시차를 두고 올린다 (방 전체에 보임)
function postLines(lines) {
  lines.forEach((e, i) => setTimeout(() => postChat(e), i * 400));
}

// ----- 1:1 취조(내 기록) -----
function pushLocal(view, entries) {
  state.threads[view].history.push(...entries);
  saveThreads();
  if (!document.getElementById('view-chatlog').classList.contains('hidden')) renderChatLog(document.getElementById('chatlog-search').value);
  if (state.currentView !== view) return;
  entries.forEach((e, i) => setTimeout(() => state.currentView === view && renderEntry(e), i * 350));
}

function renderRoster() {
  rosterEl.innerHTML = '';
  [['group', '새벽 2 시'], ['private', '수사실']].forEach(([v, label]) => {
    const btn = document.createElement('div');
    btn.className = 'roster-btn roster-room' + (state.currentView === v ? ' active' : '') + (v === 'private' ? ' roster-private' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => switchView(v));
    rosterEl.appendChild(btn);
  });
  ROSTER.forEach((name) => {
    const btn = document.createElement('div');
    btn.className = 'roster-btn' + (state.currentView === name ? ' active' : '') + (npcGone(name) ? ' roster-gone' : '');
    btn.textContent = npcGone(name) ? name + ' ✝' : name;
    btn.addEventListener('click', () => switchView(name));
    rosterEl.appendChild(btn);
  });
  dayTag.textContent = 'DAY ' + state.day;
  roomTag.textContent = room.code ? '[' + room.code + ' · ' + onlinePlayers().length + ' 명]' : '';
}
function renderEvidenceRow() {
  if (isRoomView(state.currentView) || npcGone(state.currentView)) {
    evidenceRow.classList.add('hidden');
    return;
  }
  evidenceRow.classList.remove('hidden');
  const cur = evidenceSelect.value;
  evidenceSelect.innerHTML = '';
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = state.unlocked.length ? '수첩의 단서를 골라 제시...' : '(아직 모은 단서가 없음)';
  evidenceSelect.appendChild(ph);
  state.unlocked.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.title;
    evidenceSelect.appendChild(opt);
  });
  evidenceSelect.value = cur;
}
function switchView(view) {
  state.currentView = view;
  renderRoster();
  renderEvidenceRow();
  chatLog.innerHTML = '';
  if (isRoomView(view)) {
    renderGroupChat(true);
    if (view === 'group') checkGroupEvents();
  } else {
    if (npcGone(view)) addSysLine('[' + view + ' — 접속 불가. DAY 3 밤 이후 기록이 없다. 남긴 것은 검색(메모)으로]');
    else addSysLine('[' + view + ' 취조 중... 방 전체 신뢰도 ' + trustFor(view) + ']');
    state.threads[view].history.forEach(renderEntry);
  }
}

// ===== 퍼즐 조각 =====
// 조각은 방 수첩의 단서 텍스트에서 나온다. 반환: [{text, by}] (by = 그 조각을 처음 열어 준 단서를 찾은 사람)
function availablePieces(poolName) {
  const pool = PIECE_POOLS[poolName];
  if (!pool) return [];
  if (pool.always) return pool.pieces.map((p) => ({ text: p.text, by: null }));
  const sorted = state.unlocked.slice().sort((a, b) => (a.t || 0) - (b.t || 0));
  const out = [];
  pool.pieces.forEach((p) => {
    const src = sorted.find((c) => p.match.some((m) => squash(c.title + ' ' + c.body).includes(squash(m))));
    if (src) out.push({ text: p.text, by: src.by || null });
  });
  return out;
}
function allPieceTexts() {
  const set = new Set();
  Object.keys(PIECE_POOLS).forEach((k) => {
    if (PIECE_POOLS[k].always) return;
    availablePieces(k).forEach((p) => set.add(PIECE_POOLS[k].label + ':' + p.text));
  });
  return set;
}

// ===== 단서(공유) =====
function unlockClue(id, title, body, day, opts) {
  if (has(id)) return false;
  const before = allPieceTexts();
  const rec = { id, title, body, day, by: me.name, t: Date.now() };
  state.unlocked.push(rec);
  renderEvidenceRow();
  Store.setIfAbsent(rp('unlocked/' + id), { title, body, day, by: me.name, t: rec.t });
  if (!(opts && opts.silent)) postSys('📎 ' + me.name + ' — ' + title);
  const fresh = Array.from(allPieceTexts()).filter((k) => !before.has(k)).map((k) => k.split(':').slice(1).join(':'));
  if (fresh.length) postSys('🧩 새 조각: ' + fresh.join(', ') + ' (' + me.name + ')');
  return true;
}

// ===== 그룹 이벤트 / 반응 (한 클라이언트만 발동하도록 setIfAbsent로 잠금) =====
// 새벽 2 시 방에서 새어 나간 말 (헨델이 인용한다)
const LEAK_DEFAULT = '"데미안이 범인 아니야?" — 누가 그랬더라.';
function leakText() {
  return room.leak && room.leak.text ? '"' + room.leak.text + '" — ' + (room.leak.from || '?') + ' 님이 그랬지.' : LEAK_DEFAULT;
}
function fillLeak(text) {
  return String(text).replace(/\{LEAK\}/g, () => (room.leak && room.leak.text ? room.leak.text : LEAK_DEFAULT));
}
// DAY 4부터 포청천은 없다 — 그룹채팅 대사에서 뺀다
function aliveLines(lines) {
  return lines.filter((l) => !(l.speaker && npcGone(l.speaker)));
}
function eventLines(ev) {
  return aliveLines(ev.lines.map(([who, text]) => (who === 'sys' ? { type: 'sys', text: fillLeak(text) } : { type: 'npc', text: who === HANDEL && text === '{LEAK}' ? leakText() : fillLeak(text), speaker: who })));
}
function checkGroupEvents() {
  if (!room.code) return;
  GROUP_EVENTS.forEach((ev) => {
    if (state.events.includes(ev.id) || ev.day > state.day) return;
    if (ev.requires && !ev.requires.every(has)) return;
    state.events.push(ev.id);
    Store.setIfAbsent(rp('events/' + ev.id), true).then((ok) => {
      if (!ok) return;
      const lines = eventLines(ev);
      if (ev.unlock && unlockClue(ev.unlock.id, ev.unlock.title, fillLeak(ev.unlock.body), state.day, { silent: true })) {
        lines.push({ type: 'sys', text: '📎 단서 수첩에 기록: ' + ev.unlock.title });
      }
      setTimeout(() => postLines(lines), ev.delay || 0);
    });
  });
}
function findGroupReaction(text) {
  let best = null;
  GROUP_REACTIONS.forEach((r, idx) => {
    if (r.day > state.day) return;
    if (r.requires && !r.requires.every(has)) return;
    const score = keywordScore(r.keywords, text);
    if (!score) return;
    if (!best || score > best.score || (score === best.score && r.day > best.r.day)) best = { r, score, idx };
  });
  return best;
}

// ===== NPC 대사 =====
function gateStatus(entry, npc) {
  if (entry.day > state.day) return 'day';
  if ((entry.trustMin || 0) > trustFor(npc)) return 'trust';
  if (entry.requiresAny && !entry.requiresAny.some(has)) return 'requires';
  if (entry.requires && !entry.requires.every(has)) return 'requires';
  if (entry.requiresCount && countPrefix(npc + '_d' + (entry.day - 1) + '_') < entry.requiresCount) return 'requires';
  return 'ok';
}
function better(a, b) {
  if (a.score !== b.score) return a.score > b.score;
  if (a.entry.day !== b.entry.day) return a.entry.day > b.entry.day;
  return (a.entry.trustMin || 0) > (b.entry.trustMin || 0);
}
function findNpcDialogue(npc, text) {
  let bestOk = null;
  let bestLocked = null;
  (NPC_DIALOGUE[npc] || []).forEach((entry) => {
    const score = keywordScore(entry.keywords, text);
    if (!score) return;
    const status = gateStatus(entry, npc);
    const cand = { entry, score, status };
    if (status === 'ok') {
      if (!bestOk || better(cand, bestOk)) bestOk = cand;
    } else if (!bestLocked || better(cand, bestLocked)) bestLocked = cand;
  });
  if (!bestOk) return bestLocked;
  if (bestLocked && bestLocked.status !== 'day' && bestLocked.entry.day > bestOk.entry.day && bestLocked.score >= bestOk.score) bestOk.deeper = bestLocked;
  return bestOk;
}
const DEEPER_HINTS = {
  trust: '(...말끝을 흐린다. 방 전체가 이 사람에게서 더 알아내면 말해 줄지도 모른다.)',
  requires: '(...뭔가 더 알고 있는 눈치다. 근거를 들이대면 달라질지도.)',
};
function nextUnheard(npc, preferDay) {
  const list = (NPC_DIALOGUE[npc] || []).filter((e) => !has(e.id) && gateStatus(e, npc) === 'ok');
  if (!list.length) return null;
  const same = list.filter((e) => e.day === preferDay);
  if (same.length) return same[0];
  return list.reduce((b, e) => (e.day > b.day ? e : b), list[0]);
}
function lockedHintFor(npc) {
  let pick = null;
  (NPC_DIALOGUE[npc] || []).forEach((e) => {
    const st = gateStatus(e, npc);
    if (st === 'ok' || st === 'day') return;
    if (!pick || e.day < pick.entry.day) pick = { entry: e, status: st };
  });
  if (!pick) return null;
  const lines = [DEEPER_HINTS[pick.status]];
  if (pick.status === 'requires' && pick.entry.requiresHint) lines.push('(힌트: ' + pick.entry.requiresHint + ')');
  return lines;
}
function mentionedOther(npc, text) {
  const sq = squash(text);
  return ROSTER.find((n) => n !== npc && sq.includes(squash(n))) || null;
}
function runSearchQuery(q) {
  return SEARCH_CLUES.filter((c) => c.day <= state.day && (!c.requires || c.requires.every(has)) && keywordScore(c.keywords, q) > 0);
}

// ===== 증거 제시 =====
function presentEvidence(npc, clueId) {
  const clue = state.unlocked.find((c) => c.id === clueId);
  if (!clue) return;
  if (npcGone(npc)) return pushLocal(npc, [{ type: 'me', text: '[증거 제시] ' + clue.title }, { type: 'sys', text: '(응답 없음)' }]);
  const entries = [{ type: 'me', text: '[증거 제시] ' + clue.title }];
  const key = npc + '|' + clueId;
  if (!state.presented.includes(key)) {
    state.presented.push(key);
    Store.set(rp('presented/' + npc + '|' + clueId), true);
  }
  let best = null;
  (EVIDENCE_REACTIONS[npc] || []).forEach((r) => {
    if (r.clue !== clueId || r.day > state.day) return;
    if (!best || r.day > best.day) best = r;
  });
  if (best) {
    entries.push({ type: 'npc', text: best.body, speaker: npc });
    if (best.unlock && unlockClue(best.unlock.id, best.unlock.title, best.unlock.body, state.day)) {
      entries.push({ type: 'sys', text: '📎 방 수첩에 기록: ' + best.unlock.title + ' (신뢰도 ' + trustFor(npc) + ')' });
    }
  } else entries.push({ type: 'npc', text: pickRandom(EVIDENCE_DEFAULT), speaker: npc });
  pushLocal(npc, entries);
}
function presentEvidenceByText(npc, text) {
  const nq = norm(text);
  const clue = state.unlocked.find((c) => norm(c.title).includes(nq) || norm(c.body).includes(nq));
  if (!clue) {
    addSysLine('수첩에서 "' + text + '"에 해당하는 단서를 찾지 못했습니다. 아래 메뉴에서 골라도 됩니다.');
    return;
  }
  presentEvidence(npc, clue.id);
}

// ===== 날짜 =====
function goalLines(day) {
  return (DAY_GOALS[day] || []).map((g) => (g.check(state) ? '✔ ' : '○ ') + g.label);
}
function boardForDay(day) {
  return BOARDS.find((b) => b.day === day && !b.final && !b.after);
}
// 그날의 보드 전부 (B는 A를 풀어야 보인다)
function boardsForDay(day) {
  return BOARDS.filter((b) => b.day === day && !b.final);
}
function boardVisible(b) {
  return b.day <= state.day && (!b.after || boardSolved(b.after));
}
function boardSolved(id) {
  return !!(state.boards[id] && state.boards[id].solved);
}
function dayIntroLines(day) {
  const intro = DAY_INTRO[day];
  const lines = [{ type: 'sys', text: '=== DAY ' + day + ' ===' }, { type: 'sys', text: intro.sys }];
  (intro.lines || []).forEach((l) => lines.push({ type: 'npc', text: l.text, speaker: l.speaker }));
  const nb = boardForDay(day);
  if (nb) lines.push({ type: 'sys', text: '[오늘의 추리 보드] ' + nb.title + ' — 바탕화면 "추리 보드"에서 함께 채우세요.' });
  return lines;
}
async function advanceDay() {
  if (state.day >= 5) {
    addSysLine('마지막 날입니다. 충분히 조사했다면 "최종 추리"에서 마지막 로그를 완성하세요.');
    return;
  }
  if (!isHost() && hostOnline()) {
    addSysLine('다음 날로 넘기는 건 방장(' + ((room.players[room.meta.hostId] || {}).name || '?') + ')만 할 수 있습니다.');
    return;
  }
  const board = boardsForDay(state.day).find((b) => !boardSolved(b.id));
  if (board) {
    const bs = boardState(board.id);
    const lockedN = board.slots.filter((_, i) => bs.locked[i]).length;
    addSysLine('오늘의 추리 보드를 먼저 완성하세요: ' + board.title + ' (' + lockedN + '/' + board.slots.length + ' 칸 확정)' + (board.after ? ' — 보드 A를 풀면 열립니다.' : ''));
    return;
  }
  const next = state.day + 1;
  await Store.update(rp('meta'), { day: next });
  postLines(dayIntroLines(next));
  switchView('group');
}

// ===== 추리 보드(공유) =====
function boardState(id) {
  const b = state.boards[id] || {};
  return { picks: b.picks || {}, locked: b.locked || {}, solved: !!b.solved, by: b.by || {} };
}
function setPick(boardId, i, val) {
  if (!state.boards[boardId]) state.boards[boardId] = { picks: {}, locked: {}, solved: false, by: {} };
  if (!state.boards[boardId].picks) state.boards[boardId].picks = {};
  if (!state.boards[boardId].by) state.boards[boardId].by = {};
  state.boards[boardId].picks[i] = val;
  state.boards[boardId].by[i] = val ? me.name : null;
  Store.update(rp('boards/' + boardId + '/picks'), { [i]: val || null });
  Store.update(rp('boards/' + boardId + '/by'), { [i]: val ? me.name : null });
}
const selectedSlot = {}; // boardId -> slot index (조각을 끼울 칸)
function checkBoard(board) {
  const bs = boardState(board.id);
  const unlockedIdx = board.slots.map((_, i) => i).filter((i) => !bs.locked[i]);
  const correct = unlockedIdx.filter((i) => bs.picks[i] === board.slots[i].answer);
  const wrong = unlockedIdx.length - correct.length;
  const canLock = correct.length >= 3 || (correct.length > 0 && correct.length === unlockedIdx.length);
  if (canLock) {
    const upd = {};
    correct.forEach((i) => (upd[i] = true));
    if (!state.boards[board.id]) state.boards[board.id] = { picks: {}, locked: {}, solved: false };
    state.boards[board.id].locked = { ...(state.boards[board.id].locked || {}), ...upd };
    Store.update(rp('boards/' + board.id + '/locked'), upd);
  }
  const allLocked = board.slots.every((_, i) => (state.boards[board.id] && state.boards[board.id].locked || {})[i]);
  let justSolved = false;
  if (allLocked && !bs.solved) {
    state.boards[board.id].solved = true;
    justSolved = true;
    Store.update(rp('boards/' + board.id), { solved: true });
    if (board.reward) unlockClue(board.reward.id, board.reward.title, board.reward.body, state.day, { silent: true });
    const nextB = BOARDS.find((b) => b.after === board.id);
    postSys('✔ ' + me.name + '이(가) 마지막 칸을 채워 "' + board.title + '" 보드를 완성했습니다!' + (board.reward ? ' 📎 ' + board.reward.title : '') + (nextB ? ' 🧩 보드 B가 열렸습니다: ' + nextB.title : ''));
    checkGroupEvents();
  } else if (canLock) {
    postSys('🔒 ' + me.name + ' — "' + board.title + '" ' + correct.length + ' 칸 확정 (' + board.slots.filter((_, i) => state.boards[board.id].locked[i]).length + '/' + board.slots.length + ')');
  }
  return { wrong, lockedNow: canLock ? correct.length : 0, justSolved, solved: allLocked };
}
const boardMsg = {};
function renderBoard(container, board, onSolved, onChange) {
  const bs = boardState(board.id);
  const wrap = document.createElement('div');
  wrap.className = 'board' + (bs.solved ? ' board-solved' : '');
  wrap.dataset.board = board.id;
  const head = document.createElement('div');
  head.className = 'board-title';
  head.textContent = (bs.solved ? '✔ ' : '') + board.title;
  wrap.appendChild(head);
  if (!bs.solved && board.intro) {
    const intro = document.createElement('div');
    intro.className = 'board-intro';
    intro.textContent = board.intro;
    wrap.appendChild(intro);
  }
  board.slots.forEach((slot, i) => {
    const row = document.createElement('div');
    row.className = 'board-row' + (bs.locked[i] ? ' locked' : '');
    const [before, after] = slot.text.split('[ ]');
    row.appendChild(document.createTextNode(before));
    if (bs.locked[i]) {
      const fixed = document.createElement('span');
      fixed.className = 'slot-fixed';
      fixed.textContent = slot.answer;
      row.appendChild(fixed);
    } else {
      const box = document.createElement('span');
      const isSel = selectedSlot[board.id] === i;
      box.className = 'slot-box' + (bs.picks[i] ? ' filled' : '') + (isSel ? ' selected' : '');
      box.textContent = bs.picks[i] || '［ ? ］';
      box.title = PIECE_POOLS[slot.pool] ? PIECE_POOLS[slot.pool].label + ' 조각을 끼우세요' : '';
      if (bs.picks[i] && bs.by[i]) {
        const by = document.createElement('small');
        by.className = 'slot-by';
        by.textContent = bs.by[i];
        box.appendChild(by);
      }
      box.addEventListener('click', () => {
        if (bs.picks[i] && isSel) {
          setPick(board.id, i, '');
          selectedSlot[board.id] = null;
        } else selectedSlot[board.id] = isSel ? null : i;
        onChange ? onChange() : (container.innerHTML = '', renderBoard(container, board, onSolved, onChange));
      });
      row.appendChild(box);
    }
    row.appendChild(document.createTextNode(after || ''));
    if (bs.solved && slot.why) {
      const why = document.createElement('div');
      why.className = 'slot-why';
      why.textContent = '근거: ' + slot.why;
      row.appendChild(why);
    }
    wrap.appendChild(row);
  });
  if (!bs.solved) {
    const tray = document.createElement('div');
    tray.className = 'piece-tray';
    const pools = Array.from(new Set(board.slots.filter((_, i) => !bs.locked[i]).map((sl) => sl.pool)));
    const selIdx = selectedSlot[board.id];
    const selPool = selIdx != null ? board.slots[selIdx].pool : null;
    let total = 0;
    pools.forEach((pn) => {
      const pool = PIECE_POOLS[pn];
      const avail = availablePieces(pn);
      total += avail.length;
      const group = document.createElement('div');
      group.className = 'piece-group' + (selPool && selPool !== pn ? ' dim' : '');
      const label = document.createElement('span');
      label.className = 'piece-label';
      label.textContent = pool.label + (pool.always ? '' : ' ' + avail.length + '/' + pool.pieces.length);
      group.appendChild(label);
      if (!avail.length) {
        const none = document.createElement('span');
        none.className = 'piece-none';
        none.textContent = '아직 발견된 조각 없음';
        group.appendChild(none);
      }
      avail.forEach((p) => {
        const chip = document.createElement('span');
        const used = board.slots.some((sl, i) => !bs.locked[i] && bs.picks[i] === p.text && sl.pool === pn);
        chip.className = 'piece' + (used ? ' used' : '');
        chip.textContent = p.text;
        if (p.by) chip.title = p.by + ' 발견';
        chip.addEventListener('click', () => {
          let target = selectedSlot[board.id];
          if (target == null || board.slots[target].pool !== pn) {
            target = board.slots.findIndex((sl, i) => sl.pool === pn && !bs.locked[i] && !bs.picks[i]);
            if (target < 0) target = board.slots.findIndex((sl, i) => sl.pool === pn && !bs.locked[i]);
          }
          if (target < 0) return;
          setPick(board.id, target, p.text);
          selectedSlot[board.id] = null;
          onChange ? onChange() : (container.innerHTML = '', renderBoard(container, board, onSolved, onChange));
        });
        group.appendChild(chip);
      });
      tray.appendChild(group);
    });
    const trayHead = document.createElement('div');
    trayHead.className = 'piece-head';
    trayHead.textContent = selIdx != null ? '▶ ' + (selIdx + 1) + '번 칸에 끼울 조각을 고르세요' : '조각을 누르면 빈칸에 끼워집니다. 칸을 먼저 누르면 그 칸에.';
    wrap.appendChild(trayHead);
    wrap.appendChild(tray);
    const btnRow = document.createElement('div');
    btnRow.className = 'board-actions';
    const btn = document.createElement('div');
    btn.className = 'toolbtn accuse-submit';
    btn.style.width = '90px';
    btn.style.fontWeight = '700';
    btn.textContent = '확인';
    const msg = document.createElement('div');
    msg.className = 'board-msg';
    msg.textContent = boardMsg[board.id] || '';
    btn.addEventListener('click', () => {
      const cur = boardState(board.id);
      const empty = board.slots.filter((_, i) => !cur.locked[i] && !cur.picks[i]).length;
      if (empty) {
        boardMsg[board.id] = '빈칸 ' + empty + ' 개를 먼저 채우세요.';
        msg.textContent = boardMsg[board.id];
        return;
      }
      const r = checkBoard(board);
      if (r.justSolved) {
        boardMsg[board.id] = '';
        onSolved && onSolved();
      } else if (r.lockedNow) boardMsg[board.id] = r.lockedNow + ' 칸이 확정되었습니다. 틀린 칸 ' + r.wrong + ' 개.';
      else boardMsg[board.id] = '틀린 칸 ' + r.wrong + ' 개. (맞은 칸이 3 개 이상 모여야 확정됩니다)';
      if (onChange) onChange();
      else msg.textContent = boardMsg[board.id];
    });
    btnRow.appendChild(btn);
    btnRow.appendChild(msg);
    wrap.appendChild(btnRow);
  }
  container.appendChild(wrap);
}
let lastBoardsJSON = '';
function renderBoardScreen(force) {
  const body = document.getElementById('board-body');
  const json = JSON.stringify(state.boards) + state.day + ':' + state.unlocked.length;
  if (!force && json === lastBoardsJSON && body.children.length) return;
  lastBoardsJSON = json;
  body.innerHTML = '';
  const info = document.createElement('div');
  info.className = 'board-intro';
  info.textContent = '방 전체가 함께 채우는 보드입니다. 조각은 방 수첩에 단서가 모일수록 늘어납니다. 어느 칸이 틀렸는지는 알려 주지 않습니다 — 맞은 칸이 3 개 이상 모이면 잠깁니다.';
  body.appendChild(info);
  BOARDS.filter((b) => !b.final && boardVisible(b))
    .sort((a, b) => b.day - a.day || (a.after ? -1 : 1))
    .forEach((b) => {
      const box = document.createElement('div');
      body.appendChild(box);
      renderBoard(box, b, () => {
        boardMsg['done_' + b.id] = '✔ ' + b.title + ' 완성! 방 수첩에 정리가 기록되었고, 그룹채팅에 반응이 올라왔습니다.';
        renderBoardScreen(true);
      }, () => renderBoardScreen(true));
      if (boardMsg['done_' + b.id]) {
        const done = document.createElement('div');
        done.className = 'board-done';
        done.textContent = boardMsg['done_' + b.id];
        body.insertBefore(done, body.firstChild.nextSibling);
      }
    });
}

// ===== 입력 처리 =====
async function handleSend() {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  if (text === '오늘은 여기까지') return advanceDay();
  if (ROSTER.includes(text)) return switchView(text);
  if (text === '그룹채팅' || text === '그룹' || text === '새벽 2 시' || text === '새벽2시') return switchView('group');
  if (text === '수사실') return switchView('private');
  if (text === '목표') {
    boardsForDay(state.day).forEach((b) => {
      const bs = boardState(b.id);
      addSysLine('[오늘의 추리 보드] ' + b.title + ' — ' + (bs.solved ? '완성 ✔' : !boardVisible(b) ? '(보드 A를 풀면 열림)' : b.slots.filter((_, i) => bs.locked[i]).length + '/' + b.slots.length + ' 칸 확정'));
    });
    addSysLine('[DAY ' + state.day + ' 권장 조사]');
    goalLines(state.day).forEach(addSysLine);
    return;
  }
  if (text === '방 정보' || text === '방') {
    const ps = onlinePlayers();
    addSysLine('[방 코드 ' + room.code + '] 접속 ' + ps.length + ' 명 / 최대 ' + MAX_PLAYERS + ' 명 · 방장: ' + ((room.players[room.meta.hostId] || {}).name || '?') + ' · 동기화: ' + (Store.mode === 'firebase' ? '실시간 서버' : '로컬(같은 브라우저 탭)'));
    addSysLine(ps.map((p) => p.name).join(', '));
    return;
  }
  if (text === '나가기') return leaveRoom();
  if (text === '도움말' || text === '명령어' || text === '?') return HELP_LINES.forEach(addSysLine);

  const view = state.currentView;

  if (/^검색\s*/.test(text)) {
    const q = text.replace(/^검색\s*/, '');
    searchInput.value = q;
    openScreen('search');
    runSearch();
    return;
  }
  if (text === '대화기록' || text === '대화 기록') {
    document.getElementById('chatlog-search').value = '';
    openScreen('chatlog');
    return;
  }
  if (/^대화\s*검색\s*/.test(text)) {
    const q = text.replace(/^대화\s*검색\s*/, '');
    document.getElementById('chatlog-search').value = q;
    openScreen('chatlog');
    renderChatLog(q);
    return;
  }
  if (text === '힌트') {
    addMessage('me', text);
    addMessage('other', DAY_HINTS[state.day] || DAY_HINTS[1], '힌트');
    return;
  }
  if (text === '정리해줘') {
    const open = OPEN_QUESTIONS.filter((q) => q.day <= state.day);
    const parts = ['[미해결 의문]'];
    open.forEach((q) => parts.push((q.resolvedBy.some(has) ? '✔ ' : '○ ') + q.text));
    const fs = fakeStats();
    if (fs.refuted.length) parts.push('[반박된 기록 ' + fs.refuted.length + ' 개] ' + fs.refuted.map((d) => d.title).join(' / '));
    parts.push('[방 수첩 ' + state.unlocked.length + ' 개]');
    state.unlocked.slice(-8).forEach((c) => parts.push('· ' + c.title + ' (' + c.by + ')'));
    addMessage('me', text);
    addMessage('other', parts.join('\n'), '정리');
    return;
  }

  if (view === 'private') {
    await postPrivate({ type: 'me', from: me.name, pid: me.pid, text });
    return;
  }
  if (view === 'group') {
    await postChat({ type: 'me', from: me.name, pid: me.pid, text });
    // 새벽 2 시 방에서 데미안을 범인으로 모는 말은 헨델(데미안)에게 새어 나간다 — 처음 한 번만 기록
    if (LEAK_RE.test(squash(text))) Store.setIfAbsent(rp('leak'), { text, from: me.name, pid: me.pid, t: Date.now() });
    const r = findGroupReaction(text);
    if (r) {
      const key = 'reacted/d' + state.day + '_' + r.idx;
      Store.setIfAbsent(rp(key), true).then((ok) => {
        if (ok) postLines(aliveLines(r.r.lines.map(([who, t]) => ({ type: 'npc', text: t, speaker: who }))));
      });
    } else if (Math.random() < 0.35) {
      const d = pickRandom(GROUP_DEFAULT_LINES.filter((l) => !npcGone(l.speaker)));
      setTimeout(() => postChat({ type: 'npc', text: d.text, speaker: d.speaker }), 500);
    }
    return;
  }

  // ----- 1:1 취조 -----
  const npc = view;
  const thread = state.threads[npc];
  if (npcGone(npc)) {
    return pushLocal(npc, [{ type: 'me', text }, { type: 'sys', text: '(응답 없음 — 포청천의 마지막 접속: DAY 3 밤. 남긴 것은 검색 "메모"에서)' }]);
  }
  if (/^증거\s*/.test(text)) return presentEvidenceByText(npc, text.replace(/^증거\s*/, ''));
  const entries = [{ type: 'me', text }];

  if (CONTINUE_RE.test(norm(text))) {
    const next = nextUnheard(npc, thread.lastDay || state.day);
    if (next) {
      entries.push({ type: 'npc', text: next.body, speaker: npc });
      unlockClue(next.id, next.title, next.body, next.day);
      entries.push({ type: 'sys', text: '📎 방 수첩에 기록: ' + next.title + ' (신뢰도 ' + trustFor(npc) + ')' });
      thread.lastDay = next.day;
    } else entries.push({ type: 'npc', text: CONTINUE_END[npc] || '...그게 다야.', speaker: npc });
    return pushLocal(npc, entries);
  }
  const found = findNpcDialogue(npc, text);
  const other = mentionedOther(npc, text);
  if (other && !(found && found.entry.keywords.some((k) => squash(k).includes(squash(other))))) {
    const line = NPC_OPINIONS[npc] && NPC_OPINIONS[npc][other];
    if (line) {
      entries.push({ type: 'npc', text: line, speaker: npc });
      return pushLocal(npc, entries);
    }
  }
  if ((!found || found.score < 4) && PROBE_RE.test(norm(text))) {
    entries.push({ type: 'npc', text: PROBE_LINES[npc], speaker: npc });
    const hint = lockedHintFor(npc);
    (hint || ['(지금은 더 숨기는 게 없어 보인다.)']).forEach((t) => entries.push({ type: 'sys', text: t }));
    return pushLocal(npc, entries);
  }
  if (!found) {
    thread.misses = (thread.misses || 0) + 1;
    const about = squash(text).includes('데미안') || squash(text).includes('걔');
    entries.push({ type: 'npc', text: pickRandom(about ? TOPIC_FALLBACK : NPC_DEFAULT_LINES), speaker: npc });
    if (thread.misses % 2 === 0) entries.push({ type: 'sys', text: '(힌트: 시간·장소·사람 이름처럼 구체적인 단어로 물어보거나, 아래 메뉴로 수첩의 단서를 제시해 보세요. "응", "그래서?"라고 하면 하던 얘기를 이어 갑니다.)' });
  } else if (found.status !== 'ok') {
    entries.push({ type: 'npc', text: pickRandom(LOCKED_LINES[found.status]), speaker: npc });
    if (found.status === 'requires' && found.entry.requiresHint) entries.push({ type: 'sys', text: '(힌트: ' + found.entry.requiresHint + ')' });
  } else {
    thread.misses = 0;
    thread.lastDay = found.entry.day;
    entries.push({ type: 'npc', text: found.entry.body, speaker: npc });
    if (unlockClue(found.entry.id, found.entry.title, found.entry.body, found.entry.day)) {
      entries.push({ type: 'sys', text: '📎 방 수첩에 기록: ' + found.entry.title + ' (신뢰도 ' + trustFor(npc) + ')' });
    }
    if (found.deeper) {
      entries.push({ type: 'sys', text: DEEPER_HINTS[found.deeper.status] });
      if (found.deeper.status === 'requires' && found.deeper.entry.requiresHint) entries.push({ type: 'sys', text: '(힌트: ' + found.deeper.entry.requiresHint + ')' });
    }
  }
  pushLocal(npc, entries);
}
chatSend.addEventListener('click', handleSend);
chatInput.addEventListener('keydown', (e) => e.key === 'Enter' && handleSend());
evidenceGo.addEventListener('click', () => {
  const id = evidenceSelect.value;
  if (!id || isRoomView(state.currentView)) return;
  presentEvidence(state.currentView, id);
  evidenceSelect.value = '';
});

// ===== 검색 앱 (검색엔진 화면) + 페이지 팝업 =====
const searchInput = document.getElementById('search-input');
const searchGo = document.getElementById('search-go');
const searchResults = document.getElementById('search-results');
const searchAddr = document.getElementById('search-addr');
const popupView = document.getElementById('view-popup');
const popupBody = document.getElementById('popup-body');
let popupCurrent = null;

function siteName(url) {
  const m = (url || '').match(/^https?:\/\/([^/]+)/);
  return m ? m[1] : 'moi.net';
}
// 단서 → 페이지 정의 (없으면 날짜/종류로 기본 스킨)
function pageFor(clue) {
  if (clue.page) return { ...clue.page, url: clue.page.url || clue.url };
  const p = PAGES[clue.id];
  if (p) return p;
  const d = clue.day || 1;
  if (clue.fake) return { site: 'cafe', url: 'http://cafe.moi.net/free/' + (190000 + (clue.id.length * 137) % 9000), boardName: '자유게시판', title: clue.title, author: '익명', date: 'D+' + d, views: 120, lines: [clue.body], comments: [['익명', '이거 진짜임?'], ['익명', '출처?']] };
  if (d === 2) return { site: 'log', url: 'http://moi.net/user/demian/records', title: clue.title, rows: [['기록', clue.body, '']] };
  if (d >= 5) return { site: 'wiki', url: 'http://moi.net/case/dawn2/' + clue.id, title: clue.title, lines: [clue.body] };
  if (d === 4) return { site: 'cafe', url: 'http://cafe.moi.net/dawn2/' + clue.id, boardName: '새벽 2 시 — 정리', title: clue.title, author: '포청천', date: 'D+' + d, views: 30, lines: [clue.body], comments: [] };
  return { site: 'blog', url: 'http://blog.moi.net/case/' + clue.id, blogName: '사건 노트', title: clue.title, date: 'D+' + d, views: 20 + d * 7, lines: [clue.body], comments: [] };
}
function pageUrl(clue) {
  return pageFor(clue).url || 'http://moi.net/' + clue.id;
}
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function renderPageInto(container, clue) {
  const p = pageFor(clue);
  container.innerHTML = '';
  const pg = el('div', 'pg pg-' + p.site);
  const addComments = (list, withTime) => {
    if (!list || !list.length) return;
    const box = el('div', 'pg-comments');
    box.appendChild(el('div', '', '댓글 ' + list.length));
    list.forEach((c) => {
      const row = el('div', 'pg-comment');
      const who = el('b', '', c[0]);
      row.appendChild(who);
      if (withTime && c.length === 3) row.appendChild(el('span', 't', c[1]));
      row.appendChild(document.createTextNode(' ' + (c.length === 3 ? c[2] : c[1])));
      box.appendChild(row);
    });
    pg.appendChild(box);
  };
  const addLines = (lines) => {
    const body = el('div', 'pg-body');
    (lines || []).forEach((l) => body.appendChild(el('p', '', l)));
    pg.appendChild(body);
  };
  if (p.site === 'profile') {
    pg.appendChild(el('div', 'pg-head', 'moi.net — 프로필'));
    const card = el('div', 'card');
    const av = el('div', 'av');
    av.innerHTML = OTHER_AVATAR_SVG.replace('width="16" height="16"', 'width="34" height="34"');
    card.appendChild(av);
    const kv = el('div', 'kv');
    [['닉네임', p.nick], ['가입일', p.joined], ['마지막 접속', p.lastSeen], ['상태 메시지', p.status], ['게시물', p.posts], ['친구', p.friends]].forEach(([k, v]) => {
      const line = el('div');
      line.appendChild(el('b', '', k));
      line.appendChild(document.createTextNode(String(v)));
      kv.appendChild(line);
    });
    card.appendChild(kv);
    pg.appendChild(card);
    addLines(p.lines);
  } else if (p.site === 'blog') {
    pg.appendChild(el('div', 'pg-head', p.blogName || '블로그'));
    pg.appendChild(el('div', 'pg-title', p.title || clue.title));
    pg.appendChild(el('div', 'pg-meta', (p.date || '') + ' · 조회 ' + (p.views != null ? p.views : '-')));
    addLines(p.lines);
    addComments(p.comments, false);
  } else if (p.site === 'cafe') {
    pg.appendChild(el('div', 'pg-head', '커뮤니티 › ' + (p.boardName || '자유게시판')));
    pg.appendChild(el('div', 'pg-title', p.title || clue.title));
    pg.appendChild(el('div', 'pg-meta', (p.author || '익명') + ' · ' + (p.date || '') + ' · 조회 ' + (p.views != null ? p.views : '-')));
    addLines(p.lines);
    addComments(p.comments, true);
  } else if (p.site === 'wiki') {
    pg.appendChild(el('div', 'pg-head', siteName(p.url)));
    pg.appendChild(el('div', 'pg-title', p.title || clue.title));
    addLines(p.lines);
  } else if (p.site === 'news') {
    pg.appendChild(el('div', 'pg-head', p.org || '기록'));
    pg.appendChild(el('div', 'pg-title', p.title || clue.title));
    addLines(p.lines);
  } else if (p.site === 'log') {
    pg.appendChild(el('div', 'pg-head', p.title || clue.title));
    const t = el('table');
    const hd = el('tr');
    ['시각', '이벤트', '비고'].forEach((h) => hd.appendChild(el('th', '', h)));
    t.appendChild(hd);
    (p.rows || []).forEach((r) => {
      const tr = el('tr', /^\d\d:\d\d$/.test(r[0]) || /D/.test(r[0]) ? '' : '');
      r.forEach((c) => tr.appendChild(el('td', '', c)));
      t.appendChild(tr);
    });
    const wrap = el('div', 'pg-body');
    const tw = el('div', 'tablewrap');
    tw.appendChild(t);
    wrap.appendChild(tw);
    pg.appendChild(wrap);
  } else if (p.site === 'chat') {
    pg.appendChild(el('div', 'pg-head', p.title || clue.title));
    const box = el('div', 'pg-chat');
    (p.bubbles || []).forEach(([who, tm, text]) => {
      const cb = el('div', 'cb' + (who === '데미안' ? ' r' : ''));
      cb.appendChild(el('div', 'who', who));
      cb.appendChild(el('div', 'bb' + (/열람 제한/.test(text) ? ' restricted' : ''), text));
      cb.appendChild(el('div', 'tm', tm));
      box.appendChild(cb);
    });
    pg.appendChild(box);
  } else if (p.site === 'photo') {
    pg.appendChild(el('div', 'pg-head', '커뮤니티 › 사진'));
    pg.appendChild(el('div', 'pg-title', p.title || clue.title));
    const frame = el('div', 'frame');
    const img = el('div', 'img');
    img.appendChild(el('div', 'grain'));
    frame.appendChild(img);
    frame.appendChild(el('div', 'cap', p.caption || clue.body));
    pg.appendChild(frame);
    if (p.exif) {
      const ex = el('div', 'exif');
      ex.appendChild(el('div', '', '[EXIF]'));
      Object.entries(p.exif).forEach(([k, v]) => ex.appendChild(el('div', '', k + ': ' + v)));
      pg.appendChild(ex);
    }
    addComments(p.comments, false);
  } else {
    addLines([clue.body]);
  }
  container.appendChild(pg);
}
function openPopup(clue) {
  popupCurrent = clue;
  document.getElementById('popup-title').textContent = siteName(pageUrl(clue)) + ' — ' + clue.title;
  document.getElementById('popup-url').textContent = pageUrl(clue);
  renderPageInto(popupBody, clue);
  popupBody.scrollTop = 0;
  popupView.classList.remove('hidden');
  if (!clue.noise) {
    if (unlockClue(clue.id, clue.title, clue.body, clue.day)) checkGroupEvents();
  }
}
function openPopupById(id) {
  const c = SEARCH_CLUES.find((x) => x.id === id) || NOISE_RESULTS.find((x) => x.id === id);
  if (c) openPopup(c);
}
function closePopup() {
  popupView.classList.add('hidden');
  popupCurrent = null;
}
document.getElementById('popup-close').addEventListener('click', closePopup);
document.getElementById('popup-close2').addEventListener('click', closePopup);
function sharePopup(view) {
  if (!popupCurrent) return;
  postToView(view, { type: 'link', from: me.name, pid: me.pid, clueId: popupCurrent.id, text: popupCurrent.title, url: pageUrl(popupCurrent) });
  closePopup();
  openScreen('chat');
  switchView(view);
}
document.getElementById('popup-share').addEventListener('click', () => sharePopup('group'));
document.getElementById('popup-share-private').addEventListener('click', () => sharePopup('private'));

function renderSearchResults(q, results) {
  searchResults.innerHTML = '';
  searchAddr.textContent = 'http://search.pc89.net/?q=' + encodeURIComponent(q);
  const noise = NOISE_RESULTS.filter((n) => keywordScore(['링크', '채팅방', '공지', '실종', '친구', '방'], q) > 0 || Math.random() < 0.4).slice(0, 2);
  const all = results.map((r) => ({ clue: r, noise: false })).concat(noise.map((n) => ({ clue: { ...n, noise: true }, noise: true })));
  searchResults.appendChild(el('div', 'result-count', '"' + q + '" 검색 결과 ' + all.length + ' 건'));
  if (!all.length) {
    searchResults.appendChild(el('div', 'clue-empty', SEARCH_DEFAULT));
    return;
  }
  all.forEach(({ clue, noise: isNoise }) => {
    const box = el('div', 'result');
    const title = el('div', 'result-title' + (has(clue.id) ? ' visited' : ''), clue.title);
    if (!isNoise && !has(clue.id)) title.appendChild(el('span', 'result-new', 'NEW'));
    title.addEventListener('click', () => {
      openPopup(clue);
      title.classList.add('visited');
      title.querySelector('.result-new') && title.querySelector('.result-new').remove();
    });
    box.appendChild(title);
    box.appendChild(el('div', 'result-url', pageUrl(clue)));
    box.appendChild(el('div', 'result-snip', clue.body.length > 70 ? clue.body.slice(0, 70) + '…' : clue.body));
    const rel = SEARCH_RELATED[clue.id];
    if (rel && rel.length) {
      const relEl = el('div', 'clue-related', '연관 검색어: ');
      rel.forEach((k, i) => {
        const a = el('a', '', k);
        a.href = '#';
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          searchInput.value = k;
          runSearch();
        });
        relEl.appendChild(a);
        if (i < rel.length - 1) relEl.appendChild(document.createTextNode(', '));
      });
      box.appendChild(relEl);
    }
    searchResults.appendChild(box);
  });
}
function runSearch() {
  const q = searchInput.value.trim();
  if (!q) return;
  renderSearchResults(q, runSearchQuery(q));
}
searchGo.addEventListener('click', runSearch);
searchInput.addEventListener('keydown', (e) => e.key === 'Enter' && runSearch());

// ===== 단서 수첩(공유) =====
function renderNotebook() {
  const list = document.getElementById('notebook-list');
  list.innerHTML = '';
  const open = OPEN_QUESTIONS.filter((q) => q.day <= state.day);
  const head0 = document.createElement('div');
  head0.className = 'clue-title';
  head0.textContent = '미해결 의문';
  list.appendChild(head0);
  open.forEach((q) => {
    const row = document.createElement('div');
    row.className = 'clue-body';
    const done = q.resolvedBy.some(has);
    row.textContent = (done ? '✔ ' : '○ ') + q.text;
    if (done) row.style.color = '#0a7d2c';
    list.appendChild(row);
  });
  const goalsHead = document.createElement('div');
  goalsHead.className = 'clue-title';
  goalsHead.style.marginTop = '8px';
  goalsHead.textContent = 'DAY ' + state.day + ' 권장 조사';
  list.appendChild(goalsHead);
  goalLines(state.day).forEach((t) => {
    const row = document.createElement('div');
    row.className = 'clue-body';
    row.textContent = t;
    list.appendChild(row);
  });
  const hr = document.createElement('hr');
  hr.style.cssText = 'border:none;border-top:1px solid #808080;width:100%';
  list.appendChild(hr);
  if (!state.unlocked.length) {
    const empty = document.createElement('div');
    empty.className = 'clue-empty';
    empty.textContent = '아직 방에 모인 단서가 없습니다. 6 명을 나눠 맡아 취조를 시작하세요.';
    list.appendChild(empty);
    return;
  }
  const head = document.createElement('div');
  head.className = 'clue-title';
  head.textContent = '방 수첩 (' + state.unlocked.length + ')';
  list.appendChild(head);
  state.unlocked
    .slice()
    .sort((a, b) => a.day - b.day || a.t - b.t)
    .forEach((c) => {
      const card = document.createElement('div');
      card.className = 'clue-card';
      const title = document.createElement('div');
      title.className = 'clue-title';
      title.textContent = 'DAY ' + c.day + ' · ' + c.title;
      const body = document.createElement('div');
      body.className = 'clue-body';
      body.textContent = c.body;
      const by = document.createElement('div');
      by.className = 'clue-by';
      by.textContent = '— ' + (c.by || '?');
      const def0 = clueDef(c.id);
      if (def0) {
        const open = document.createElement('span');
        open.className = 'clue-open';
        open.textContent = '페이지 열기';
        open.addEventListener('click', () => openPopup(def0));
        by.appendChild(open);
      }
      card.appendChild(title);
      card.appendChild(body);
      card.appendChild(by);
      const def = clueDef(c.id);
      if (isRefuted(def)) {
        card.classList.add('clue-refuted');
        title.textContent = '✘ 반박됨 · ' + c.title;
        const why = document.createElement('div');
        why.className = 'clue-refute';
        why.textContent = '→ 이 기록은 사실이 아니다. 근거: ' + refutationTitles(def).join(', ');
        card.appendChild(why);
      }
      list.appendChild(card);
    });
}


// ===== 대화 기록 (자동 응답 대신 지난 대사를 열람·검색) =====
// 자동으로 나온 NPC 대사·그룹채팅·수사실 대화를 전부 모아서, 키워드로 다시 찾아볼 수 있게 한다.
// DM(1:1 취조) 기록은 이 브라우저(나)만의 것이고, 새벽 2 시·수사실은 방 전체가 공유한 기록이다.
function chatLogSections() {
  const sections = [{ id: 'group', label: '새벽 2 시 (공유)', entries: chatEntries('group') }, { id: 'private', label: '수사실 (공유)', entries: chatEntries('private') }];
  ROSTER.forEach((npc) => sections.push({ id: npc, label: npc + ' — 1:1 취조 (나만 보임)', entries: (state.threads[npc] && state.threads[npc].history) || [] }));
  return sections;
}
function chatLogEntryText(e) {
  if (e.type === 'sys') return e.text;
  if (e.type === 'link') return '🔗 ' + e.text;
  if (e.type === 'me') return (e.pid && e.pid !== me.pid ? (e.from || '?') : '나') + ': ' + e.text;
  return (e.speaker || '?') + ': ' + e.text;
}
function renderChatLog(query) {
  const body = document.getElementById('chatlog-body');
  body.innerHTML = '';
  const q = query ? squash(norm(query)) : '';
  const sections = chatLogSections();
  let totalHits = 0;
  let day = 1;
  sections.forEach((sec) => {
    day = 1;
    const matches = sec.entries.filter((e) => {
      const m = e.type === 'sys' && typeof e.text === 'string' && e.text.match(/=== DAY (\d+) ===/);
      if (m) day = m[1];
      return e.text && (!q || squash(norm(e.text)).includes(q));
    });
    if (q && !matches.length) return;
    body.appendChild(el('div', 'clue-title', sec.label + (q ? ' — ' + matches.length + ' 건 일치' : ' (' + sec.entries.length + ' 줄)')));
    if (!matches.length) {
      body.appendChild(el('div', 'clue-empty', '아직 대화가 없습니다.'));
      return;
    }
    day = 1;
    matches.forEach((e) => {
      const m = e.type === 'sys' && typeof e.text === 'string' && e.text.match(/=== DAY (\d+) ===/);
      if (m) day = m[1];
      const row = el('div', 'clue-body chatlog-row');
      const prefix = sec.id === 'group' || sec.id === 'private' ? 'DAY ' + day + ' · ' : '';
      row.textContent = prefix + chatLogEntryText(e);
      body.appendChild(row);
      totalHits++;
    });
  });
  if (q && !totalHits) body.appendChild(el('div', 'clue-empty', '"' + query + '"에 해당하는 대화를 찾지 못했습니다. 아직 그 얘기가 안 나왔거나, 다른 낱말로 물어봤을 수 있습니다.'));
}
const chatlogSearch = document.getElementById('chatlog-search');
chatlogSearch.addEventListener('input', () => renderChatLog(chatlogSearch.value));
document.getElementById('chatlog-clear').addEventListener('click', () => { chatlogSearch.value = ''; renderChatLog(''); });

// ===== 최종 추리(공유 보드) =====
function renderAccuse() {
  const body = document.getElementById('accuse-body');
  body.innerHTML = '';
  const final = BOARDS.find((b) => b.final);
  const info = document.createElement('div');
  info.className = 'board-intro';
  info.textContent = '방 전체의 조사로 마지막 로그를 완성하세요. (DAY ' + state.day + ' · 방 수첩 ' + state.unlocked.length + ' 개)';
  body.appendChild(info);
  const box = document.createElement('div');
  body.appendChild(box);
  const resultBox = document.createElement('div');
  resultBox.id = 'accuse-result';
  body.appendChild(resultBox);
  // 보드를 다 채우면 방 전체가 한 사람을 지목한다 (공유). 데미안 → TRUE END, NPC → BAD END
  const showVerdictPick = () => {
    const pick = document.createElement('div');
    pick.className = 'verdict-pick';
    const head = document.createElement('div');
    head.className = 'board-title';
    head.textContent = '마지막 로그가 완성됐다. 경찰에 알릴 한 사람을 지목하세요. (방 전체에 적용, 되돌릴 수 없음)';
    pick.appendChild(head);
    const row = document.createElement('div');
    row.className = 'verdict-row';
    ALIVE_NPCS.concat(['데미안']).forEach((name) => {
      const b = document.createElement('div');
      b.className = 'toolbtn verdict-btn';
      b.textContent = name;
      b.addEventListener('click', () => {
        Store.setIfAbsent(rp('verdict'), { name, by: me.name, t: Date.now() }).then((ok) => {
          if (ok) postSys('⚖ ' + me.name + '이(가) 방 전체의 이름으로 ' + name + '을(를) 지목했습니다. 바탕화면 "최종 추리"에서 결말을 확인하세요.');
        });
      });
      row.appendChild(b);
    });
    pick.appendChild(row);
    resultBox.className = '';
    resultBox.innerHTML = '';
    resultBox.appendChild(pick);
  };
  const showResult = () => {
    const fs = fakeStats();
    const v = room.verdict;
    const trueEnd = v && v.name === '데미안';
    const perfect = trueEnd && has('ev_d5_handel') && fs.found.length >= 5 && fs.refuted.length === fs.found.length;
    let verdict;
    if (perfect) verdict = '★★ PERFECT — 검거. 데미안을 지목했고, 헨델까지 특정했으며, 찾아낸 가짜 기록을 하나도 남기지 않고 전부 반박했습니다.';
    else if (trueEnd) verdict = ENDING_TRUE;
    else verdict = ENDING_BAD.replace(/\{X\}/g, v.name);
    const lines = [verdict, '', '[지목] ' + v.name + ' — ' + (v.by || '?') + ' 님이 방 전체의 이름으로'];
    if (fs.found.length) {
      lines.push('', '[가짜 기록] 찾은 ' + fs.found.length + ' 개 중 ' + fs.refuted.length + ' 개 반박');
      fs.found.forEach((d) => lines.push((isRefuted(d) ? '   ✘ ' : '   ○ ') + d.title));
    }
    lines.push('', '[함께한 사람들] ' + Object.values(room.players || {}).map((p) => p.name).join(', '));
    lines.push('', '[진실]', TRUE_STORY_TEXT);
    resultBox.className = 'accuse-result' + (trueEnd ? '' : ' accuse-bad');
    resultBox.textContent = lines.join('\n');
  };
  const bs = boardState(final.id);
  renderBoard(box, final, () => {
    postSys('★ 마지막 로그가 완성되었습니다. 바탕화면 "최종 추리"에서 결말을 확인하세요.');
    renderAccuse();
  }, () => renderAccuse());
  const btn = box.querySelector('.accuse-submit');
  if (btn) {
    btn.addEventListener('click', () => {
      const cur = boardState(final.id);
      const baited = FAKE_CLUES.filter((f) => f.bait && has(f.id) && !cur.locked[f.bait.slot] && cur.picks[f.bait.slot] === f.bait.opt);
      const m = box.querySelector('.board-msg');
      if (baited.length && m && !cur.solved) m.textContent += ' ⚠ 수첩의 어떤 기록은 사실이 아닐 수 있습니다.';
    });
  }
  if (bs.solved) (room.verdict ? showResult() : showVerdictPick());
}

// ===== 방 입장/생성/동기화 =====
function syncMirror() {
  state.day = (room.meta && room.meta.day) || 1;
  state.unlocked = Object.entries(room.unlocked || {}).map(([id, v]) => ({ id, ...v }));
  state.boards = room.boards || {};
  state.events = Object.keys(room.events || {});
  state.presented = Object.keys(room.presented || {});
}
function onRoomChange(section) {
  syncMirror();
  if (lobbyView.classList.contains('hidden')) {
    renderRoster();
    if ((section === 'chat' && state.currentView === 'group') || (section === 'private' && state.currentView === 'private')) renderGroupChat(false);
    if (section === 'verdict' && !document.getElementById('view-accuse').classList.contains('hidden')) renderAccuse();
    if (section === 'unlocked') renderEvidenceRow();
    if (section === 'boards' || section === 'meta') {
      if (!document.getElementById('view-board').classList.contains('hidden')) renderBoardScreen();
      if (!document.getElementById('view-accuse').classList.contains('hidden') && section === 'boards') renderAccuse();
    }
    if (section === 'unlocked' && !document.getElementById('view-folder').classList.contains('hidden')) renderNotebook();
    if (section === 'unlocked' && !document.getElementById('view-board').classList.contains('hidden')) renderBoardScreen();
    if (section === 'unlocked' && !document.getElementById('view-accuse').classList.contains('hidden')) renderAccuse();
    if ((section === 'chat' || section === 'private') && !document.getElementById('view-chatlog').classList.contains('hidden')) renderChatLog(document.getElementById('chatlog-search').value);
    if (section === 'meta' || section === 'unlocked') checkGroupEvents();
  }
}
function subscribeRoom() {
  unsubs.splice(0).forEach((u) => u());
  ['meta', 'players', 'unlocked', 'boards', 'events', 'presented', 'reacted'].forEach((sec) => {
    unsubs.push(Store.on(rp(sec), (v) => { room[sec] = v || (sec === 'meta' ? null : {}); onRoomChange(sec); }));
  });
  ['leak', 'verdict'].forEach((sec) => unsubs.push(Store.on(rp(sec), (v) => { room[sec] = v || null; onRoomChange(sec); })));
  unsubs.push(Store.on(rp('chat'), (v) => { room.chat = v || {}; onRoomChange('chat'); }, { limitToLast: 300 }));
  unsubs.push(Store.on(rp('private'), (v) => { room.private = v || {}; onRoomChange('private'); }, { limitToLast: 300 }));
}
let presenceTimer = null;
function heartbeat() {
  if (!room.code) return;
  Store.update(rp('players/' + me.pid), { name: me.name, lastSeen: Date.now() });
}
async function enterRoom(code) {
  room.code = code;
  state.threads = loadJSON(dmKey(), null) || freshThreads();
  ROSTER.forEach((n) => { if (!state.threads[n]) state.threads[n] = { history: [] }; });
  state.currentView = 'group';
  await heartbeat();
  subscribeRoom();
  clearInterval(presenceTimer);
  presenceTimer = setInterval(heartbeat, 20000);
  saveJSON('lastlog-session', { code }, sessionStorage);
  lobbyView.classList.add('hidden');
  closeToDesktop();
}
function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
async function createRoom() {
  const code = randomCode();
  room.code = code;
  await Store.set(rp('meta'), { createdAt: Date.now(), hostId: me.pid, day: 1 });
  const intro = [
    '새벽 2 시 채팅방에 입장했습니다. 현재 접속자 13 명.',
    ROSTER.concat(['데미안']).join(', ') + ' — 그리고 당신들.',
    '23:58 고니: "데미안?"',
    '00:01 계룡맛: "아직 안 왔는데?"',
    '00:03 wkwkdfoq: "오늘 아예 안 오는 거 아님?"',
    '00:05 고니: "얘 원래 이 시간엔 꼭 오는데."',
    '[데미안님의 마지막 접속: 18 시간 전]',
  ].map((text) => ({ type: 'sys', text }));
  const lines = intro.concat(dayIntroLines(1), HELP_LINES.map((text) => ({ type: 'sys', text })));
  for (const l of lines) await postChat(l);
  await enterRoom(code);
}
async function joinRoom(code) {
  code = (code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error('방 코드는 6 자리입니다.');
  const meta = await Store.get('rooms/' + code + '/meta');
  if (!meta) throw new Error('그런 방이 없습니다. 코드를 확인하세요.');
  const players = (await Store.get('rooms/' + code + '/players')) || {};
  const active = Object.entries(players).filter(([pid, p]) => pid !== me.pid && Date.now() - (p.lastSeen || 0) < 90000);
  if (active.length >= MAX_PLAYERS) throw new Error('방이 가득 찼습니다 (최대 ' + MAX_PLAYERS + ' 명).');
  await enterRoom(code);
  postSys('👤 ' + me.name + ' 님이 입장했습니다.');
}
function leaveRoom() {
  unsubs.splice(0).forEach((u) => u());
  clearInterval(presenceTimer);
  if (room.code) Store.set(rp('players/' + me.pid), null);
  room.code = null;
  sessionStorage.removeItem('lastlog-session');
  closeToDesktop();
  lobbyView.classList.remove('hidden');
}

// ===== 로비 =====
const lobbyName = document.getElementById('lobby-name');
const lobbyCode = document.getElementById('lobby-code');
const lobbyMsg = document.getElementById('lobby-msg');
lobbyName.value = me.name || '';
function lobbyError(msg) {
  lobbyMsg.textContent = msg;
}
function takeName() {
  const n = lobbyName.value.trim().slice(0, 12);
  if (!n) {
    lobbyError('닉네임을 입력하세요.');
    return null;
  }
  me.name = n;
  saveJSON('lastlog-name', n);
  return n;
}
document.getElementById('lobby-create').addEventListener('click', async () => {
  if (!takeName()) return;
  lobbyError('방을 만드는 중...');
  try {
    await createRoom();
  } catch (e) {
    lobbyError('실패: ' + e.message);
  }
});
document.getElementById('lobby-join').addEventListener('click', async () => {
  if (!takeName()) return;
  lobbyError('입장 중...');
  try {
    await joinRoom(lobbyCode.value);
  } catch (e) {
    lobbyError(e.message);
  }
});
lobbyCode.addEventListener('keydown', (e) => e.key === 'Enter' && document.getElementById('lobby-join').click());

// ===== 시작 =====
Store.init();
document.getElementById('lobby-mode').textContent =
  Store.mode === 'firebase' ? '실시간 서버 연결됨 — 다른 기기의 친구들과 같은 방에서 플레이할 수 있습니다.' : '로컬 모드 — 같은 브라우저의 탭끼리만 동기화됩니다. (Firebase Realtime Database 미설정)';
(async () => {
  const sess = loadJSON('lastlog-session', null, sessionStorage);
  if (sess && sess.code && me.name) {
    try {
      const meta = await Store.get('rooms/' + sess.code + '/meta');
      if (meta) {
        await enterRoom(sess.code);
        return;
      }
    } catch (e) {}
    sessionStorage.removeItem('lastlog-session');
  }
  lobbyView.classList.remove('hidden');
})();

// ===== 화면 크기에 맞춰 축소 =====
// 화면은 CSS로 뷰포트에 맞춘다(축소 변환 없음). 휴대폰 주소창·키보드 때문에 실제 높이가 바뀌면 --vh를 갱신한다.
function fitStage() {
  document.documentElement.style.setProperty('--vh', window.innerHeight + 'px');
}
window.addEventListener('resize', fitStage);
if (window.visualViewport) window.visualViewport.addEventListener('resize', fitStage);
fitStage();
