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

// ===== 키워드 매칭 =====
// 부분 입력 허용(한 단어 키워드), 여러 단어 키워드는 통째로 포함되어야 함.
// 반환값: 매치된 키워드 중 가장 긴 것의 길이 (0이면 매치 없음). 길수록 더 구체적인 질문으로 본다.
function norm(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[?!.,~…"'“”]+/g, ' ')
    .replace(/[ㅋㅎㅠㅜ]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// 비교는 띄어쓰기를 전부 무시하고 한다 ("23시 18분" == "23 시 18 분" == "23시18분")
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
    // 점수는 띄어쓰기를 포함한 길이: "왜 싸웠"(4)이 "데미안"(3)보다 구체적이다
    if (hit && spaced.length > best) best = spaced.length;
  });
  return best;
}

const CONTINUE_RE = /^(응|어|음|오|헐|그래서|계속|더|더 말해 ?줘|더 말해|자세히|그리고|그 ?다음|왜|진짜|그래|응응|ㅇㅇ|ㅇㅋ|근데|근데 왜|그런데|말해 ?줘|말해 ?봐|그래서 뭐|그리고 나서|또)$/;
const PROBE_RE = /(숨기|숨긴|숨겨|비밀 ?있|거짓말 ?하|거짓말 ?이|뭐 ?있지|수상|요즘 ?어땠|요즘 ?어때|이상한 ?거 ?없|할 ?말 ?없|말 ?안 ?한 ?거|솔직히 ?말)/;

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ===== 게임 상태 =====
const DAY_HINTS = {
  1: '6 명 모두에게 먼저 "데미안"에 대해 물어보고, 검색 앱에서 "데미안"을 검색해 보세요.',
  2: '검색 앱에서 "재접속", "23:18", "23:07", "00:03"을 찾아보고, 찾은 기록을 NPC에게 증거로 제시해 보세요. 검색 결과가 전부 사실은 아닙니다 — 수상한 기록도 관련자에게 제시해 보세요.',
  3: '"미끼 정보"를 검색한 뒤, 그 단서를 6 명 각각에게 제시해 보세요. 사람마다 들은 이야기가 다릅니다.',
  4: '"23:52"와 "01:12" 기록을 찾아 호호19와 포청천에게 제시하세요. 한 사람의 고백이 다른 사람의 입을 엽니다.',
  5: '포청천에게 01:12 기록을 다시 제시하고, "정보 유출 구조"를 검색해 보세요. 조건이 갖춰지면 그룹채팅에 무언가 올라옵니다.',
};

const HELP_LINES = [
  '명령어: 닉네임 입력 → 1:1 채팅 | 그룹채팅 | 검색 ○○ | 증거 ○○ | 목표 | 힌트 | 정리해줘 | 오늘은 여기까지',
  '1:1 채팅에서는 아래 "증거 제시" 메뉴로 수첩의 단서를 상대에게 보여 줄 수 있습니다.',
];

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
        presented: state.presented,
        events: state.events,
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
    presented: [],
    events: [],
  };
// 이전 버전 저장 데이터 호환
state.presented = state.presented || [];
state.events = state.events || [];
ROSTER.forEach((n) => {
  if (!state.threads[n]) state.threads[n] = { history: [] };
});

function has(id) {
  return state.unlocked.some((c) => c.id === id);
}

function countPrefix(prefix) {
  return state.unlocked.filter((c) => c.id.startsWith(prefix)).length;
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
  const refuted = found.filter(isRefuted);
  return { found, refuted };
}

// 신뢰도 = 이 NPC에게서 이미 알아낸 서로 다른 사실의 개수 (대화 + 증거 제시). 스팸으로는 늘릴 수 없음.
function trustFor(npc) {
  return countPrefix(npc + '_');
}

const chatLog = document.getElementById('chat-log');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const rosterEl = document.getElementById('roster');
const dayTag = document.getElementById('day-tag');
const evidenceRow = document.getElementById('evidence-row');
const evidenceSelect = document.getElementById('evidence-select');
const evidenceGo = document.getElementById('evidence-go');

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

// 여러 줄을 채팅처럼 시차를 두고 출력 (기록에는 즉시 저장)
function pushLines(view, entries) {
  state.threads[view].history.push(...entries);
  if (state.currentView !== view) return;
  entries.forEach((e, i) => {
    setTimeout(() => {
      if (state.currentView === view) renderHistoryEntry(e);
    }, i * 350);
  });
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

function renderEvidenceRow() {
  if (state.currentView === 'group') {
    evidenceRow.classList.add('hidden');
    return;
  }
  evidenceRow.classList.remove('hidden');
  evidenceSelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = state.unlocked.length ? '수첩의 단서를 골라 제시...' : '(아직 모은 단서가 없음)';
  evidenceSelect.appendChild(placeholder);
  state.unlocked.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.title;
    evidenceSelect.appendChild(opt);
  });
}

function switchView(view) {
  state.currentView = view;
  renderRoster();
  renderEvidenceRow();
  chatLog.innerHTML = '';
  if (view === 'group') {
    addSysLine('[새벽 2 시 그룹채팅방]');
  } else {
    addSysLine('[' + view + ' 접속 중... 신뢰도 ' + trustFor(view) + ']');
  }
  state.threads[view].history.forEach(renderHistoryEntry);
  if (view === 'group') checkGroupEvents();
  saveState();
}

function goalLines(day) {
  const goals = DAY_GOALS[day] || [];
  return goals.map((g) => (g.check(state) ? '✔ ' : '○ ') + g.label);
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
  addSysLine('=== DAY 1 ===');
  addSysLine(DAY_INTRO[1].sys);
  HELP_LINES.forEach(addSysLine);
  addSysLine('[오늘 목표]');
  goalLines(1).forEach(addSysLine);
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
  if (has(id)) return false;
  state.unlocked.push({ id, title, body, day });
  renderEvidenceRow();
  return true;
}

function advanceDay() {
  if (state.day >= 5) {
    addSysLine('마지막 날입니다. 충분히 조사했다면 바탕화면의 "최종 추리"로 가세요.');
    return;
  }
  const unmet = (DAY_GOALS[state.day] || []).filter((g) => !g.check(state));
  if (unmet.length) {
    addSysLine('아직 오늘 할 일이 남았습니다:');
    unmet.forEach((g) => addSysLine('○ ' + g.label));
    addSysLine('("목표"라고 입력하면 언제든 다시 볼 수 있습니다)');
    return;
  }
  state.day++;
  const intro = DAY_INTRO[state.day];
  const entries = [{ type: 'sys', text: '=== DAY ' + state.day + ' ===' }, { type: 'sys', text: intro.sys }];
  (intro.lines || []).forEach((l) => entries.push({ type: 'npc', text: l.text, speaker: l.speaker }));
  entries.push({ type: 'sys', text: '[오늘 목표]' });
  goalLines(state.day).forEach((t) => entries.push({ type: 'sys', text: t }));
  state.threads.group.history.push(...entries);
  switchView('group');
  saveState();
}

// ===== 그룹 이벤트 =====
function checkGroupEvents() {
  GROUP_EVENTS.forEach((ev) => {
    if (state.events.includes(ev.id)) return;
    if (ev.day > state.day) return;
    if (ev.requires && !ev.requires.every(has)) return;
    state.events.push(ev.id);
    const entries = ev.lines.map(([who, text]) => (who === 'sys' ? { type: 'sys', text } : { type: 'npc', text, speaker: who }));
    if (ev.unlock) {
      unlockClue(ev.unlock.id, ev.unlock.title, ev.unlock.body, state.day);
      entries.push({ type: 'sys', text: '📎 단서 수첩에 기록: ' + ev.unlock.title });
    }
    pushLines('group', entries);
  });
  saveState();
}

// ===== NPC 대사 찾기 =====
function gateStatus(entry, npc) {
  if (entry.day > state.day) return 'day';
  if ((entry.trustMin || 0) > trustFor(npc)) return 'trust';
  if (entry.requiresAny && !entry.requiresAny.some(has)) return 'requires';
  if (entry.requires && !entry.requires.every(has)) return 'requires';
  if (entry.requiresCount && countPrefix(npc + '_d' + (entry.day - 1) + '_') < entry.requiresCount) return 'requires';
  return 'ok';
}

function better(a, b) {
  // 더 구체적인 키워드 > 더 깊은 날짜 > 더 높은 신뢰 조건
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
    } else if (!bestLocked || better(cand, bestLocked)) {
      bestLocked = cand;
    }
  });
  if (!bestOk) return bestLocked;
  // 같은 키워드에 더 깊은(잠긴) 대사가 있으면 알려 준다 — 아직 열리지 않은 날짜의 대사는 제외
  if (bestLocked && bestLocked.status !== 'day' && bestLocked.entry.day > bestOk.entry.day && bestLocked.score >= bestOk.score) {
    bestOk.deeper = bestLocked;
  }
  return bestOk;
}

const DEEPER_HINTS = {
  trust: '(...말끝을 흐린다. 더 친해지면 말해 줄지도 모른다.)',
  requires: '(...뭔가 더 알고 있는 눈치다. 근거를 들이대면 달라질지도.)',
};

// 이 NPC에게서 지금 당장 열 수 있는데 아직 안 들은 대사 (이어 말하기용). 같은 날짜 화제를 우선.
function nextUnheard(npc, preferDay) {
  const list = (NPC_DIALOGUE[npc] || []).filter((e) => !has(e.id) && gateStatus(e, npc) === 'ok');
  if (!list.length) return null;
  const same = list.filter((e) => e.day === preferDay);
  if (same.length) return same[0];
  let best = list[0];
  list.forEach((e) => {
    if (e.day > best.day) best = e;
  });
  return best;
}

// 떠보기에 대한 답 뒤에 붙일 "지금 뭐가 부족한지" 힌트
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

function findGroupReaction(text) {
  let best = null;
  GROUP_REACTIONS.forEach((r) => {
    if (r.day > state.day) return;
    if (r.requires && !r.requires.every(has)) return;
    const score = keywordScore(r.keywords, text);
    if (!score) return;
    if (!best || score > best.score || (score === best.score && r.day > best.r.day)) best = { r, score };
  });
  return best ? best.r : null;
}

function runSearchQuery(q) {
  return SEARCH_CLUES.filter((c) => c.day <= state.day && (!c.requires || c.requires.every(has)) && keywordScore(c.keywords, q) > 0);
}

// ===== 증거 제시 =====
function presentEvidence(npc, clueId) {
  const clue = state.unlocked.find((c) => c.id === clueId);
  if (!clue) return;
  const thread = state.threads[npc];
  const meLine = { type: 'me', text: '[증거 제시] ' + clue.title };
  thread.history.push(meLine);
  if (state.currentView === npc) renderHistoryEntry(meLine);

  const key = npc + '|' + clueId;
  if (!state.presented.includes(key)) state.presented.push(key);

  let best = null;
  (EVIDENCE_REACTIONS[npc] || []).forEach((r) => {
    if (r.clue !== clueId || r.day > state.day) return;
    if (!best || r.day > best.day) best = r;
  });

  const entries = [];
  if (best) {
    entries.push({ type: 'npc', text: best.body, speaker: npc });
    if (best.unlock && unlockClue(best.unlock.id, best.unlock.title, best.unlock.body, state.day)) {
      entries.push({ type: 'sys', text: '📎 단서 수첩에 기록: ' + best.unlock.title + ' (신뢰도 ' + trustFor(npc) + ')' });
    }
  } else {
    entries.push({ type: 'npc', text: pickRandom(EVIDENCE_DEFAULT), speaker: npc });
  }
  pushLines(npc, entries);
  saveState();
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

// ===== 입력 처리 =====
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
  if (text === '목표') {
    addSysLine('[DAY ' + state.day + ' 목표]');
    goalLines(state.day).forEach(addSysLine);
    return;
  }
  if (text === '도움말' || text === '명령어' || text === '?') {
    HELP_LINES.forEach(addSysLine);
    return;
  }

  const view = state.currentView;
  const thread = state.threads[view];

  if (/^검색\s*/.test(text)) {
    thread.history.push({ type: 'me', text });
    addMessage('me', text);
    const q = text.replace(/^검색\s*/, '');
    const results = runSearchQuery(q);
    let reply;
    if (results.length) {
      const fresh = [];
      results.forEach((r) => {
        if (unlockClue(r.id, r.title, r.body, r.day)) fresh.push(r.title);
      });
      reply = results.map((r) => r.title + ' — ' + r.body).join('\n');
      const rel = results.flatMap((r) => SEARCH_RELATED[r.id] || []);
      if (rel.length) reply += '\n연관 검색어: ' + Array.from(new Set(rel)).join(', ');
      thread.history.push({ type: 'npc', text: reply, speaker: '검색결과' });
      addMessage('other', reply, '검색결과');
      fresh.forEach((t) => {
        const e = { type: 'sys', text: '📎 단서 수첩에 기록: ' + t };
        thread.history.push(e);
        renderHistoryEntry(e);
      });
    } else {
      reply = SEARCH_DEFAULT;
      thread.history.push({ type: 'npc', text: reply, speaker: '검색결과' });
      addMessage('other', reply, '검색결과');
    }
    if (view === 'group') checkGroupEvents();
    saveState();
    return;
  }

  if (text === '힌트') {
    const reply = DAY_HINTS[state.day] || DAY_HINTS[1];
    thread.history.push({ type: 'me', text }, { type: 'npc', text: reply, speaker: '힌트' });
    addMessage('me', text);
    addMessage('other', reply, '힌트');
    saveState();
    return;
  }

  if (text === '정리해줘') {
    const open = OPEN_QUESTIONS.filter((q) => q.day <= state.day);
    const parts = [];
    if (open.length) {
      parts.push('[미해결 의문]');
      open.forEach((q) => parts.push((q.resolvedBy.some(has) ? '✔ ' : '○ ') + q.text));
    }
    const fs = fakeStats();
    if (fs.refuted.length) parts.push('[반박된 기록 ' + fs.refuted.length + ' 개] ' + fs.refuted.map((d) => d.title).join(' / '));
    parts.push('[모은 단서 ' + state.unlocked.length + ' 개]');
    state.unlocked.slice(-8).forEach((c) => parts.push('· ' + c.title));
    if (state.unlocked.length > 8) parts.push('(전체 목록은 단서 수첩에서)');
    const reply = parts.join('\n');
    thread.history.push({ type: 'me', text }, { type: 'npc', text: reply, speaker: '정리' });
    addMessage('me', text);
    addMessage('other', reply, '정리');
    saveState();
    return;
  }

  if (view !== 'group' && /^증거\s*/.test(text)) {
    presentEvidenceByText(view, text.replace(/^증거\s*/, ''));
    return;
  }

  thread.history.push({ type: 'me', text });
  addMessage('me', text);

  if (view === 'group') {
    const r = findGroupReaction(text);
    let entries;
    if (r) {
      entries = r.lines.map(([who, t]) => ({ type: 'npc', text: t, speaker: who }));
    } else {
      const d = pickRandom(GROUP_DEFAULT_LINES);
      entries = [{ type: 'npc', text: d.text, speaker: d.speaker }];
    }
    pushLines('group', entries);
    saveState();
    return;
  }

  const npc = view;
  const entries = [];

  // 1) 이어 말하기: "응", "그래서?", "더 말해줘" → 같은 화제의 아직 안 들은 대사
  if (CONTINUE_RE.test(norm(text))) {
    const next = nextUnheard(npc, thread.lastDay || state.day);
    if (next) {
      entries.push({ type: 'npc', text: next.body, speaker: npc });
      unlockClue(next.id, next.title, next.body, next.day);
      entries.push({ type: 'sys', text: '📎 단서 수첩에 기록: ' + next.title + ' (신뢰도 ' + trustFor(npc) + ')' });
      thread.lastDay = next.day;
    } else {
      entries.push({ type: 'npc', text: CONTINUE_END[npc] || '...그게 다야.', speaker: npc });
    }
    pushLines(npc, entries);
    saveState();
    return;
  }

  let found = findNpcDialogue(npc, text);

  // 2) 다른 NPC 얘기: 그 이름을 가진 전용 키워드가 없으면 인물평으로 답한다
  const other = mentionedOther(npc, text);
  if (other && !(found && found.entry.keywords.some((k) => squash(k).includes(squash(other))))) {
    const line = NPC_OPINIONS[npc] && NPC_OPINIONS[npc][other];
    if (line) {
      entries.push({ type: 'npc', text: line, speaker: npc });
      pushLines(npc, entries);
      saveState();
      return;
    }
  }

  // 3) 떠보기: "뭐 숨기는 거 있지?" → 회피 + 지금 뭐가 부족한지
  if ((!found || found.score < 4) && PROBE_RE.test(norm(text))) {
    entries.push({ type: 'npc', text: PROBE_LINES[npc], speaker: npc });
    const hint = lockedHintFor(npc);
    if (hint) hint.forEach((t) => entries.push({ type: 'sys', text: t }));
    else entries.push({ type: 'sys', text: '(지금은 더 숨기는 게 없어 보인다.)' });
    pushLines(npc, entries);
    saveState();
    return;
  }

  if (!found) {
    thread.misses = (thread.misses || 0) + 1;
    const aboutDemian = squash(text).includes('데미안') || squash(text).includes('걔');
    entries.push({ type: 'npc', text: pickRandom(aboutDemian ? TOPIC_FALLBACK : NPC_DEFAULT_LINES), speaker: npc });
    if (thread.misses % 2 === 0) {
      entries.push({ type: 'sys', text: '(힌트: 시간·장소·사람 이름처럼 구체적인 단어로 물어보거나, 아래 메뉴로 수첩의 단서를 제시해 보세요. "응", "그래서?"라고 하면 하던 얘기를 이어 갑니다.)' });
    }
  } else if (found.status !== 'ok') {
    entries.push({ type: 'npc', text: pickRandom(LOCKED_LINES[found.status]), speaker: npc });
    if (found.status === 'requires' && found.entry.requiresHint) {
      entries.push({ type: 'sys', text: '(힌트: ' + found.entry.requiresHint + ')' });
    }
  } else {
    thread.misses = 0;
    thread.lastDay = found.entry.day;
    entries.push({ type: 'npc', text: found.entry.body, speaker: npc });
    if (unlockClue(found.entry.id, found.entry.title, found.entry.body, found.entry.day)) {
      entries.push({ type: 'sys', text: '📎 단서 수첩에 기록: ' + found.entry.title + ' (신뢰도 ' + trustFor(npc) + ')' });
    }
    if (found.deeper) {
      entries.push({ type: 'sys', text: DEEPER_HINTS[found.deeper.status] });
      if (found.deeper.status === 'requires' && found.deeper.entry.requiresHint) {
        entries.push({ type: 'sys', text: '(힌트: ' + found.deeper.entry.requiresHint + ')' });
      }
    }
  }
  pushLines(npc, entries);
  saveState();
}

chatSend.addEventListener('click', handleSend);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSend();
});
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
  results.forEach((r) => {
    if (unlockClue(r.id, r.title, r.body, r.day)) fresh.push(r.id);
  });
  saveState();
  renderSearchResults(results, fresh);
}
searchGo.addEventListener('click', runSearch);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runSearch();
});

// ===== 단서 수첩 =====
function renderNotebook() {
  const list = document.getElementById('notebook-list');
  list.innerHTML = '';

  const open = OPEN_QUESTIONS.filter((q) => q.day <= state.day);
  if (open.length) {
    const head = document.createElement('div');
    head.className = 'clue-title';
    head.textContent = '미해결 의문';
    list.appendChild(head);
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
    goalsHead.textContent = 'DAY ' + state.day + ' 목표';
    list.appendChild(goalsHead);
    goalLines(state.day).forEach((t) => {
      const row = document.createElement('div');
      row.className = 'clue-body';
      row.textContent = t;
      list.appendChild(row);
    });
    const hr = document.createElement('hr');
    hr.style.border = 'none';
    hr.style.borderTop = '1px solid #808080';
    hr.style.width = '100%';
    list.appendChild(hr);
  }

  if (!state.unlocked.length) {
    const empty = document.createElement('div');
    empty.className = 'clue-empty';
    empty.textContent = '아직 알아낸 단서가 없습니다. moi.net과 검색에서 조사를 시작하세요.';
    list.appendChild(empty);
    return;
  }
  const head = document.createElement('div');
  head.className = 'clue-title';
  head.textContent = '모은 단서 (' + state.unlocked.length + ')';
  list.appendChild(head);
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

// ===== 최종 추리 =====
function renderAccuse() {
  const body = document.getElementById('accuse-body');
  body.innerHTML = '';

  const info = document.createElement('div');
  info.style.marginBottom = '10px';
  info.style.color = '#555';
  info.textContent = '지금까지의 조사 내용을 바탕으로 답해주세요. (DAY ' + state.day + ' · 단서 ' + state.unlocked.length + ' 개)';
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
    const trueEnd = score === 5 && has('ev_demian_post');
    const fs = fakeStats();
    const perfect = trueEnd && fs.found.length >= 5 && fs.refuted.length === fs.found.length;
    let verdict;
    if (perfect) verdict = '★★ PERFECT — 진실에 도달했고, 찾아낸 가짜 기록을 하나도 남기지 않고 전부 반박했습니다.';
    else if (trueEnd) verdict = '★ TRUE END — 데미안이 남긴 마지막 로그까지 전부 읽어 냈습니다.';
    else if (score === 5) verdict = '완벽한 추리입니다. 하지만 데미안의 예약 게시물은 아직 열지 못했습니다.';
    else if (score >= 3) verdict = '거의 다 왔습니다. 큰 흐름은 맞지만 세부 사항을 놓쳤습니다.';
    else verdict = '아직 사건의 실체에 닿지 못했습니다.';

    const lines = [verdict + ' (' + score + '/5)', ''];
    FINAL_QUESTIONS.forEach((q, i) => {
      const ok = selections[i] === q.correct;
      lines.push((ok ? '✔ ' : '✘ ') + q.q);
      if (!ok) {
        lines.push('   정답: ' + q.options[q.correct]);
        const bait = FAKE_CLUES.find((f) => f.bait.q === i && f.bait.opt === selections[i]);
        if (bait && has(bait.id)) {
          lines.push(
            isRefuted(bait)
              ? '   ⚠ 이미 반박된 기록 "' + bait.title + '"에 속았습니다.'
              : '   ⚠ "' + bait.title + '" 기록에 속았습니다. 이 기록은 사실이 아닙니다 — 관련자에게 제시하면 반박됩니다.'
          );
        }
      }
      lines.push('   근거: ' + q.why);
    });
    if (fs.found.length) {
      lines.push('', '[가짜 기록] 찾은 ' + fs.found.length + ' 개 중 ' + fs.refuted.length + ' 개 반박');
      fs.found.forEach((d) => lines.push((isRefuted(d) ? '   ✘ ' : '   ○ ') + d.title));
    }
    lines.push('', '[진실]', TRUE_STORY_TEXT);
    resultBox.className = 'accuse-result';
    resultBox.textContent = lines.join('\n');
  });
}

// ===== 초기화 =====
document.querySelector('[data-open="chat"]').addEventListener('click', () => {
  const isFirstTime = ensureNickname();
  if (isFirstTime) {
    state.currentView = 'group';
    renderRoster();
    renderEvidenceRow();
    showIntro();
    saveState();
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
