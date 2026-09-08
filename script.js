const SCREENS = ['profile', 'chat', 'search', 'folder', 'internet'];
const TITLES = {
  profile: '내 프로필',
  chat: 'moi.net',
  search: '검색',
  folder: '내 폴더',
  internet: '인터넷 브라우저',
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

// moi.net chat
const chatLog = document.getElementById('chat-log');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');

const OTHER_AVATAR_SVG =
  '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="6" r="3" fill="#f2c48a"/><path d="M2 15c1-4 4-5 6-5s5 1 6 5" fill="#3b6fa8"/></svg>';

function addMessage(from, text) {
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

  const bubble = document.createElement('div');
  bubble.className = from === 'me' ? 'bubble-out' : 'bubble-in';
  bubble.textContent = text;

  row.appendChild(avatar);
  row.appendChild(bubble);
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

addMessage('other', '안녕하세요! moi.net에 접속하신 걸 환영합니다 :)');
addMessage('me', '네, 반가워요~');
addMessage('other', '오늘 대화방에 새로운 소식이 올라왔어요.');

// 검색
const SEARCH_INDEX = [
  {
    title: 'PC-89 사용자 모임 - 최신 소식과 팁',
    url: 'www.pc89-club.net',
    snippet: '우리 모임에 오신 걸 환영합니다. 최신 소프트웨어 소식을 확인하세요.',
    keywords: ['pc89', 'pc-89', '소식', '모임', '소프트웨어'],
  },
  {
    title: '오늘의 날씨 정보',
    url: 'weather.pc89.net',
    snippet: '전국 날씨와 기온 정보를 안내합니다.',
    keywords: ['날씨', '기온', 'weather'],
  },
  {
    title: '레트로 게임 다운로드 자료실',
    url: 'games.pc89.net',
    snippet: '고전 PC 게임을 무료로 내려받을 수 있는 자료실입니다.',
    keywords: ['게임', 'game', '레트로', '다운로드'],
  },
  {
    title: 'moi.net - 실시간 채팅 서비스',
    url: 'moi.net',
    snippet: '친구들과 실시간으로 대화할 수 있는 채팅 서비스입니다.',
    keywords: ['moi', 'moi.net', '채팅', '메신저'],
  },
];

const searchInput = document.getElementById('search-input');
const searchGo = document.getElementById('search-go');
const searchResults = document.getElementById('search-results');

function renderSearchResults(query) {
  searchResults.innerHTML = '';
  const q = query.trim().toLowerCase();

  const items = q
    ? SEARCH_INDEX.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.snippet.toLowerCase().includes(q) ||
          item.keywords.some((k) => k.toLowerCase().includes(q))
      )
    : SEARCH_INDEX;

  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.style.fontSize = '12px';
    empty.style.color = '#666';
    empty.textContent = '"' + query + '"에 대한 검색 결과가 없습니다.';
    searchResults.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const wrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'result-title';
    title.textContent = item.title;
    const url = document.createElement('div');
    url.className = 'result-url';
    url.textContent = item.url;
    const snip = document.createElement('div');
    snip.className = 'result-snip';
    snip.textContent = item.snippet;
    wrap.appendChild(title);
    wrap.appendChild(url);
    wrap.appendChild(snip);
    searchResults.appendChild(wrap);
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

// scale the whole monitor to fit small viewports
const bezel = document.getElementById('bezel');
function fitStage() {
  const margin = 40;
  const scale = Math.min(1, (window.innerWidth - margin) / 460, (window.innerHeight - margin) / 560);
  bezel.style.transform = 'scale(' + scale + ')';
}
window.addEventListener('resize', fitStage);
fitStage();
