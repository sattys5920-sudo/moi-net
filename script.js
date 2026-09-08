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

// ===== moi.net 채팅방 (실종 전날 로그 + 자유 채팅) =====
const chatLog = document.getElementById('chat-log');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');

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

function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  addMessage('me', text);
  chatInput.value = '';
}

chatSend.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

CHATLOG_SEED.forEach((m) => addMessage(m.from, m.text, m.name));

// ===== 검색 (수사 시스템) =====
const searchInput = document.getElementById('search-input');
const searchGo = document.getElementById('search-go');
const searchResults = document.getElementById('search-results');

const foundClueIds = new Set();
const revealedKeywords = new Set();

function norm(s) {
  return s.trim().toLowerCase();
}

function requirementsMet(clue) {
  return clue.requires.every((id) => foundClueIds.has(id));
}

function matchesQuery(clue, q) {
  return clue.keywords.some((k) => {
    const nk = norm(k);
    if (q.includes(nk)) return true; // 검색어가 키워드 전체를 포함 (조합 키워드는 이 방향만 허용)
    if (!nk.includes(' ') && nk.includes(q)) return true; // 단일 단어 키워드는 일부만 입력해도 매칭
    return false;
  });
}

function renderSearchResults(query) {
  searchResults.innerHTML = '';
  const q = norm(query);

  if (!q) {
    const hint = document.createElement('div');
    hint.className = 'clue-empty';
    hint.textContent = '검색어를 입력해 조사를 시작하세요. (예: 실종자의 닉네임)';
    searchResults.appendChild(hint);
    return;
  }

  const matched = CLUES.filter((c) => requirementsMet(c) && matchesQuery(c, q));

  if (matched.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'clue-empty';
    empty.textContent = '"' + query + '"에 대한 검색 결과가 없습니다. 다른 키워드로 시도해 보세요.';
    searchResults.appendChild(empty);
    return;
  }

  matched.forEach((clue) => {
    const isNew = !foundClueIds.has(clue.id);
    foundClueIds.add(clue.id);
    clue.reveals.forEach((k) => revealedKeywords.add(k));

    const card = document.createElement('div');
    card.className = 'clue-card';
    const title = document.createElement('div');
    title.className = 'clue-title';
    title.textContent = (isNew ? '🆕 ' : '') + clue.title;
    const body = document.createElement('div');
    body.className = 'clue-body';
    body.textContent = clue.body;
    card.appendChild(title);
    card.appendChild(body);
    if (clue.reveals.length) {
      const kw = document.createElement('div');
      kw.style.fontSize = '10.5px';
      kw.style.color = '#3f6b4a';
      kw.style.marginTop = '3px';
      kw.textContent = '새 검색어: ' + clue.reveals.join(', ');
      card.appendChild(kw);
    }
    searchResults.appendChild(card);
  });
}

function runSearch() {
  renderSearchResults(searchInput.value);
}

searchGo.addEventListener('click', runSearch);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runSearch();
});

renderSearchResults('');

// ===== 단서 수첩 =====
function renderNotebook() {
  const list = document.getElementById('notebook-list');
  list.innerHTML = '';

  if (foundClueIds.size === 0) {
    const empty = document.createElement('div');
    empty.className = 'clue-empty';
    empty.textContent = '아직 발견한 단서가 없습니다. 검색을 통해 조사를 시작하세요.';
    list.appendChild(empty);
    return;
  }

  const sorted = [...foundClueIds].sort((a, b) => a - b);
  sorted.forEach((id) => {
    const clue = CLUES.find((c) => c.id === id);
    const card = document.createElement('div');
    card.className = 'clue-card';
    const title = document.createElement('div');
    title.className = 'clue-title';
    title.textContent = '#' + clue.id + ' ' + clue.title;
    const body = document.createElement('div');
    body.className = 'clue-body';
    body.textContent = clue.body;
    card.appendChild(title);
    card.appendChild(body);
    list.appendChild(card);
  });
}

// ===== 최종 추리 =====
const ACCUSE_QUESTIONS = [
  {
    key: 'culprit',
    title: '1. 범인은 누구인가?',
    options: Object.values(SUSPECTS).map((s) => ({ value: s.id, label: s.name + ' (' + s.nick + ')' })),
  },
  {
    key: 'location',
    title: '2. 실종자는 어디에서 마지막으로 발견되었는가?',
    options: [
      { value: '온새미로', label: '다락방 카페 인근 골목 (온새미로)' },
      { value: '표민준의 자택', label: '표민준의 자택' },
      { value: '알 수 없음', label: '알 수 없음' },
    ],
  },
  {
    key: 'photoReason',
    title: '3. 사진에서 실종자를 삭제한 이유는 무엇인가?',
    options: [
      { value: '도경이 그날 그 장소에 없었던 것처럼 보이게 하려고', label: '도경이 그날 그 장소에 없었던 것처럼 보이게 하려고' },
      { value: '윤소하가 자기 얼굴이 마음에 안 들어서', label: '윤소하가 자기 얼굴이 마음에 안 들어서' },
      { value: '단순 재미로 합성', label: '단순 재미로 합성' },
    ],
  },
  {
    key: 'method',
    title: '4. 범인은 어떻게 자신의 알리바이를 만들었는가?',
    options: [
      { value: '평소처럼 존재감 없이 행동하며 의심을 피함', label: '평소처럼 존재감 없이 행동하며 의심을 피함' },
      { value: '가짜 CCTV 영상을 조작함', label: '가짜 CCTV 영상을 조작함' },
      { value: '완벽한 알리바이를 미리 준비해둠', label: '완벽한 알리바이를 미리 준비해둠' },
    ],
  },
];

function renderAccuse() {
  const body = document.getElementById('accuse-body');
  body.innerHTML = '';

  const foundCount = document.createElement('div');
  foundCount.style.marginBottom = '10px';
  foundCount.style.color = '#555';
  foundCount.textContent = '지금까지 발견한 단서: ' + foundClueIds.size + ' / ' + CLUES.length;
  body.appendChild(foundCount);

  const answers = {};

  ACCUSE_QUESTIONS.forEach((q) => {
    const group = document.createElement('div');
    group.className = 'qgroup';
    const title = document.createElement('div');
    title.className = 'qgroup-title';
    title.textContent = q.title;
    group.appendChild(title);

    q.options.forEach((opt) => {
      const label = document.createElement('label');
      label.className = 'qoption';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = q.key;
      radio.value = opt.value;
      radio.addEventListener('change', () => {
        answers[q.key] = opt.value;
      });
      label.appendChild(radio);
      label.appendChild(document.createTextNode(opt.label));
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
    if (Object.keys(answers).length < ACCUSE_QUESTIONS.length) {
      resultBox.className = 'accuse-result';
      resultBox.textContent = '4가지 질문에 모두 답해주세요.';
      return;
    }
    let correct = 0;
    if (answers.culprit === TRUTH.culprit) correct++;
    if (answers.location === TRUTH.location) correct++;
    if (answers.photoReason === TRUTH.photoReason) correct++;
    if (answers.method === TRUTH.method) correct++;

    let verdict, detail;
    if (correct === 4) {
      verdict = '완벽한 추리';
      detail = '모든 단서를 정확히 연결했습니다. 백준경(고요)이 10년 전 사촌 백가영의 실종을 감추기 위해 한도경을 온새미로 골목으로 불러냈고, 자신이 그곳에 있었다는 사실을 지우기 위해 단체사진에서 한도경을 삭제했다는 진실을 완전히 밝혀냈습니다.';
    } else if (correct >= 2) {
      verdict = '부분적으로 맞힌 추리';
      detail = '사건의 큰 줄기는 맞혔지만, 일부 세부 사항을 놓쳤습니다. (' + correct + '/4 정답)';
    } else {
      verdict = '잘못된 추리';
      detail = '핵심 단서들이 충분히 연결되지 않았습니다. 단서 수첩을 다시 확인하고 검색을 이어가 보세요. (' + correct + '/4 정답)';
    }

    resultBox.className = 'accuse-result';
    resultBox.innerHTML = '<strong>' + verdict + '</strong><br>' + detail;
  });
}

// ===== 화면 크기에 맞춰 축소 =====
const bezel = document.getElementById('bezel');
function fitStage() {
  const margin = 40;
  const scale = Math.min(1, (window.innerWidth - margin) / 460, (window.innerHeight - margin) / 560);
  bezel.style.transform = 'scale(' + scale + ')';
}
window.addEventListener('resize', fitStage);
fitStage();
