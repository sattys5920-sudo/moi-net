// ===== 실시간 동기화 계층 =====
// Firebase Realtime Database가 설정되어 있으면 그걸 쓰고, 아니면 같은 브라우저의 탭끼리만 동기화되는 로컬 모드로 동작한다.
// 두 백엔드 모두 같은 인터페이스: get / set / update / push / setIfAbsent / on(path, cb, {limitToLast})

function LocalBackend() {
  const KEY = 'lastlog-rooms-v1';
  let tree = {};
  try {
    tree = JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch (e) {}
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('lastlog-rooms') : null;
  const listeners = [];

  function getAt(path) {
    return path.split('/').reduce((o, k) => (o && typeof o === 'object' && o[k] !== undefined ? o[k] : undefined), tree);
  }
  function setAt(path, val) {
    const ks = path.split('/');
    let o = tree;
    for (let i = 0; i < ks.length - 1; i++) {
      if (typeof o[ks[i]] !== 'object' || o[ks[i]] === null) o[ks[i]] = {};
      o = o[ks[i]];
    }
    if (val === null || val === undefined) delete o[ks[ks.length - 1]];
    else o[ks[ks.length - 1]] = val;
  }
  function view(l) {
    let v = getAt(l.path);
    if (v === undefined) return null;
    if (l.opts && l.opts.limitToLast && v && typeof v === 'object') {
      const keys = Object.keys(v).sort();
      const out = {};
      keys.slice(-l.opts.limitToLast).forEach((k) => (out[k] = v[k]));
      return out;
    }
    return v;
  }
  function notify(changed) {
    listeners.slice().forEach((l) => {
      if (changed.startsWith(l.path) || l.path.startsWith(changed)) l.cb(view(l));
    });
  }
  function commit(path) {
    try {
      localStorage.setItem(KEY, JSON.stringify(tree));
    } catch (e) {}
    notify(path);
    if (bc) bc.postMessage({ path, tree });
  }
  if (bc) {
    bc.onmessage = (e) => {
      tree = e.data.tree;
      notify(e.data.path);
    };
  }
  let seq = 0;
  return {
    mode: 'local',
    get: async (p) => {
      const v = getAt(p);
      return v === undefined ? null : v;
    },
    set: async (p, v) => {
      setAt(p, v);
      commit(p);
    },
    update: async (p, obj) => {
      Object.entries(obj).forEach(([k, v]) => setAt(p + '/' + k, v));
      commit(p);
    },
    push: async (p, v) => {
      const id = String(Date.now()).padStart(14, '0') + '-' + String(seq++).padStart(4, '0') + Math.random().toString(36).slice(2, 5);
      setAt(p + '/' + id, v);
      commit(p);
      return id;
    },
    setIfAbsent: async (p, v) => {
      if (getAt(p) !== undefined) return false;
      setAt(p, v);
      commit(p);
      return true;
    },
    on: (p, cb, opts) => {
      const l = { path: p, cb, opts };
      listeners.push(l);
      cb(view(l));
      return () => {
        const i = listeners.indexOf(l);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
  };
}

function FirebaseBackend(db) {
  return {
    mode: 'firebase',
    get: async (p) => (await db.ref(p).get()).val(),
    set: (p, v) => db.ref(p).set(v),
    update: (p, o) => db.ref(p).update(o),
    push: async (p, v) => {
      const r = db.ref(p).push();
      await r.set(v);
      return r.key;
    },
    setIfAbsent: async (p, v) => {
      const res = await db.ref(p).transaction((cur) => (cur === null ? v : undefined));
      return !!res.committed;
    },
    on: (p, cb, opts) => {
      let q = db.ref(p);
      if (opts && opts.limitToLast) q = q.limitToLast(opts.limitToLast);
      const h = q.on('value', (s) => cb(s.val()));
      return () => q.off('value', h);
    },
  };
}

const Store = (() => {
  let backend = null;
  function init() {
    try {
      if (window.firebase && firebase.apps && firebase.apps.length) {
        backend = FirebaseBackend(firebase.database());
        return backend;
      }
    } catch (e) {
      console.warn('Firebase Realtime Database를 사용할 수 없어 로컬 모드로 동작합니다.', e && e.message);
    }
    backend = LocalBackend();
    return backend;
  }
  return {
    init,
    get mode() {
      return backend ? backend.mode : 'none';
    },
    get: (p) => backend.get(p),
    set: (p, v) => backend.set(p, v),
    update: (p, o) => backend.update(p, o),
    push: (p, v) => backend.push(p, v),
    setIfAbsent: (p, v) => backend.setIfAbsent(p, v),
    on: (p, cb, opts) => backend.on(p, cb, opts),
  };
})();
