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

// scale the whole monitor to fit small viewports
const bezel = document.getElementById('bezel');
function fitStage() {
  const margin = 40;
  const scale = Math.min(1, (window.innerWidth - margin) / 460, (window.innerHeight - margin) / 560);
  bezel.style.transform = 'scale(' + scale + ')';
}
window.addEventListener('resize', fitStage);
fitStage();
