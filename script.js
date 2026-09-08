// ===== LAST LOG : 마지막 접속 — 협동 라이브 추리 (최대 12 명) =====
// 각자 NPC를 따로 취조하지만, 알아낸 단서·수첩·추리 보드·그룹채팅은 방 전체가 실시간으로 공유한다.

const SCREENS = ['profile', 'chat', 'search', 'folder', 'board', 'internet', 'accuse'];
const TITLES = {
  profile: '내 프로필',
  chat: 'moi.net',
  search: '검색',
  folder: '단서 수첩',
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
  if (name === 'board') renderBoardScreen();
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
  4: '"23:52"와 "01:12" 기록을 찾아 호호19와 포청천에게 제시하세요. 한 사람의 고백이 다른 사람의 입을 엽니다.',
  5: '포청천에게 01:12 기록을 다시 제시하고 "정보 유출 구조"를 검색해 보세요. 조건이 갖춰지면 그룹채팅에 무언가 올라옵니다.',
};
const HELP_LINES = [
  '명령어: 닉네임 입력 → 1:1 취조 | 그룹채팅 | 검색 ○○ | 증거 ○○ | 목표 | 힌트 | 정리해줘 | 방 정보 | 오늘은 여기까지(방장)',
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

const room = { code: null, meta: null, players: {}, unlocked: {}, boards: {}, events: {}, presented: {}, chat: {}, reacted: {} };
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
  else if (e.type === 'me') {
    if (e.pid === me.pid || !e.pid) addMessage('me', e.text);
    else addMessage('other', e.text, e.from, true);
  } else addMessage('other', e.text, e.speaker);
}

// ----- 그룹채팅(공유) -----
let renderedChatKeys = new Set();
function chatEntries() {
  return Object.keys(room.chat || {})
    .sort()
    .map((k) => ({ key: k, ...room.chat[k] }));
}
function renderGroupChat(full) {
  if (state.currentView !== 'group') return;
  if (full) {
    chatLog.innerHTML = '';
    renderedChatKeys = new Set();
    addSysLine('[새벽 2 시 그룹채팅방 · 방 코드 ' + room.code + ']');
  }
  chatEntries().forEach((e) => {
    if (renderedChatKeys.has(e.key)) return;
    renderedChatKeys.add(e.key);
    renderEntry(e);
  });
}
async function postChat(entry) {
  return Store.push(rp('chat'), { t: Date.now(), ...entry });
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
  if (state.currentView !== view) return;
  entries.forEach((e, i) => setTimeout(() => state.currentView === view && renderEntry(e), i * 350));
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
  roomTag.textContent = room.code ? '[' + room.code + ' · ' + onlinePlayers().length + ' 명]' : '';
}
function renderEvidenceRow() {
  if (state.currentView === 'group') {
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
  if (view === 'group') {
    renderGroupChat(true);
    checkGroupEvents();
  } else {
    addSysLine('[' + view + ' 취조 중... 방 전체 신뢰도 ' + trustFor(view) + ']');
    state.threads[view].history.forEach(renderEntry);
  }
}

// ===== 단서(공유) =====
function unlockClue(id, title, body, day, opts) {
  if (has(id)) return false;
  const rec = { id, title, body, day, by: me.name, t: Date.now() };
  state.unlocked.push(rec);
  renderEvidenceRow();
  Store.setIfAbsent(rp('unlocked/' + id), { title, body, day, by: me.name, t: rec.t });
  if (!(opts && opts.silent)) postSys('📎 ' + me.name + ' — ' + title);
  return true;
}

// ===== 그룹 이벤트 / 반응 (한 클라이언트만 발동하도록 setIfAbsent로 잠금) =====
function eventLines(ev) {
  return ev.lines.map(([who, text]) => (who === 'sys' ? { type: 'sys', text } : { type: 'npc', text, speaker: who }));
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
      if (ev.unlock && unlockClue(ev.unlock.id, ev.unlock.title, ev.unlock.body, state.day, { silent: true })) {
        lines.push({ type: 'sys', text: '📎 단서 수첩에 기록: ' + ev.unlock.title });
      }
      postLines(lines);
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
  return BOARDS.find((b) => b.day === day && !b.final);
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
  const board = boardForDay(state.day);
  if (board && !boardSolved(board.id)) {
    const bs = boardState(board.id);
    const lockedN = board.slots.filter((_, i) => bs.locked[i]).length;
    addSysLine('오늘의 추리 보드를 먼저 완성하세요: ' + board.title + ' (' + lockedN + '/' + board.slots.length + ' 칸 확정)');
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
  return { picks: b.picks || {}, locked: b.locked || {}, solved: !!b.solved };
}
function setPick(boardId, i, val) {
  if (!state.boards[boardId]) state.boards[boardId] = { picks: {}, locked: {}, solved: false };
  if (!state.boards[boardId].picks) state.boards[boardId].picks = {};
  state.boards[boardId].picks[i] = val;
  Store.update(rp('boards/' + boardId + '/picks'), { [i]: val });
}
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
    postSys('✔ ' + me.name + '이(가) 마지막 칸을 채워 "' + board.title + '" 보드를 완성했습니다!' + (board.reward ? ' 📎 ' + board.reward.title : ''));
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
      const sel = document.createElement('select');
      sel.className = 'slot-select';
      const ph = document.createElement('option');
      ph.value = '';
      ph.textContent = '［ ? ］';
      sel.appendChild(ph);
      slot.choices.forEach((c) => {
        const o = document.createElement('option');
        o.value = c;
        o.textContent = c;
        if (bs.picks[i] === c) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', () => setPick(board.id, i, sel.value));
      row.appendChild(sel);
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
  const json = JSON.stringify(state.boards) + state.day;
  if (!force && json === lastBoardsJSON && body.children.length) return;
  lastBoardsJSON = json;
  body.innerHTML = '';
  const info = document.createElement('div');
  info.className = 'board-intro';
  info.textContent = '방 전체가 함께 채우는 보드입니다. 어느 칸이 틀렸는지는 알려 주지 않습니다 — 맞은 칸이 3 개 이상 모이면 잠깁니다. 오늘 보드를 다 잠그면 방장이 다음 날로 넘길 수 있습니다.';
  body.appendChild(info);
  BOARDS.filter((b) => !b.final && b.day <= state.day)
    .sort((a, b) => b.day - a.day)
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
  if (text === '그룹채팅' || text === '그룹') return switchView('group');
  if (text === '목표') {
    const b = boardForDay(state.day);
    if (b) {
      const bs = boardState(b.id);
      addSysLine('[오늘의 추리 보드] ' + b.title + ' — ' + (bs.solved ? '완성 ✔' : b.slots.filter((_, i) => bs.locked[i]).length + '/' + b.slots.length + ' 칸 확정'));
    }
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
    const results = runSearchQuery(q);
    let reply = SEARCH_DEFAULT;
    if (results.length) {
      results.forEach((r) => unlockClue(r.id, r.title, r.body, r.day));
      reply = results.map((r) => r.title + ' — ' + r.body).join('\n');
      const rel = Array.from(new Set(results.flatMap((r) => SEARCH_RELATED[r.id] || [])));
      if (rel.length) reply += '\n연관 검색어: ' + rel.join(', ');
    }
    addMessage('me', text);
    addMessage('other', reply, '검색결과');
    if (view !== 'group') {
      state.threads[view].history.push({ type: 'me', text }, { type: 'npc', text: reply, speaker: '검색결과' });
      saveThreads();
    }
    checkGroupEvents();
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

  if (view === 'group') {
    await postChat({ type: 'me', from: me.name, pid: me.pid, text });
    const r = findGroupReaction(text);
    if (r) {
      const key = 'reacted/d' + state.day + '_' + r.idx;
      Store.setIfAbsent(rp(key), true).then((ok) => {
        if (ok) postLines(r.r.lines.map(([who, t]) => ({ type: 'npc', text: t, speaker: who })));
      });
    } else if (Math.random() < 0.35) {
      const d = pickRandom(GROUP_DEFAULT_LINES);
      setTimeout(() => postChat({ type: 'npc', text: d.text, speaker: d.speaker }), 500);
    }
    return;
  }

  // ----- 1:1 취조 -----
  const npc = view;
  const thread = state.threads[npc];
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
  if (!id || state.currentView === 'group') return;
  presentEvidence(state.currentView, id);
  evidenceSelect.value = '';
});

// ===== 검색 앱 =====
const searchInput = document.getElementById('search-input');
const searchGo = document.getElementById('search-go');
const searchResults = document.getElementById('search-results');
function renderSearchResults(results, freshIds) {
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
    title.textContent = r.title + (freshIds.includes(r.id) ? '  [NEW]' : '');
    const body = document.createElement('div');
    body.className = 'clue-body';
    body.textContent = r.body;
    card.appendChild(title);
    card.appendChild(body);
    const rel = SEARCH_RELATED[r.id];
    if (rel && rel.length) {
      const relEl = document.createElement('div');
      relEl.className = 'clue-related';
      relEl.textContent = '연관 검색어: ';
      rel.forEach((k, i) => {
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = k;
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          searchInput.value = k;
          runSearch();
        });
        relEl.appendChild(a);
        if (i < rel.length - 1) relEl.appendChild(document.createTextNode(', '));
      });
      card.appendChild(relEl);
    }
    searchResults.appendChild(card);
  });
}
function runSearch() {
  const q = searchInput.value.trim();
  if (!q) return;
  const results = runSearchQuery(q);
  const fresh = [];
  results.forEach((r) => unlockClue(r.id, r.title, r.body, r.day) && fresh.push(r.id));
  renderSearchResults(results, fresh);
  checkGroupEvents();
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
  const showResult = () => {
    const fs = fakeStats();
    const trueEnd = has('ev_demian_post');
    const perfect = trueEnd && fs.found.length >= 5 && fs.refuted.length === fs.found.length;
    let verdict;
    if (perfect) verdict = '★★ PERFECT — 진실에 도달했고, 찾아낸 가짜 기록을 하나도 남기지 않고 전부 반박했습니다.';
    else if (trueEnd) verdict = '★ TRUE END — 데미안이 남긴 마지막 로그까지 전부 읽어 냈습니다.';
    else verdict = '보드는 완성했습니다. 하지만 데미안의 예약 게시물은 아직 열지 못했습니다. (DAY 5 그룹채팅)';
    const lines = [verdict];
    if (fs.found.length) {
      lines.push('', '[가짜 기록] 찾은 ' + fs.found.length + ' 개 중 ' + fs.refuted.length + ' 개 반박');
      fs.found.forEach((d) => lines.push((isRefuted(d) ? '   ✘ ' : '   ○ ') + d.title));
    }
    lines.push('', '[함께한 사람들] ' + Object.values(room.players || {}).map((p) => p.name).join(', '));
    lines.push('', '[진실]', TRUE_STORY_TEXT);
    resultBox.className = 'accuse-result';
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
  if (bs.solved) showResult();
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
    if (section === 'chat') renderGroupChat(false);
    if (section === 'unlocked') renderEvidenceRow();
    if (section === 'boards' || section === 'meta') {
      if (!document.getElementById('view-board').classList.contains('hidden')) renderBoardScreen();
      if (!document.getElementById('view-accuse').classList.contains('hidden') && section === 'boards') renderAccuse();
    }
    if (section === 'unlocked' && !document.getElementById('view-folder').classList.contains('hidden')) renderNotebook();
    if (section === 'meta' || section === 'unlocked') checkGroupEvents();
  }
}
function subscribeRoom() {
  unsubs.splice(0).forEach((u) => u());
  ['meta', 'players', 'unlocked', 'boards', 'events', 'presented', 'reacted'].forEach((sec) => {
    unsubs.push(Store.on(rp(sec), (v) => { room[sec] = v || (sec === 'meta' ? null : {}); onRoomChange(sec); }));
  });
  unsubs.push(Store.on(rp('chat'), (v) => { room.chat = v || {}; onRoomChange('chat'); }, { limitToLast: 300 }));
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
const bezel = document.getElementById('bezel');
function fitStage() {
  const margin = 40;
  const scale = Math.min(1, (window.innerWidth - margin) / 460, (window.innerHeight - margin) / 560);
  bezel.style.transform = 'scale(' + scale + ')';
}
window.addEventListener('resize', fitStage);
fitStage();
