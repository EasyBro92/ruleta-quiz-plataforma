/* Capa de datos única para toda la app.
   - Modo DEMO: todo se guarda en el navegador (localStorage) y se sincroniza entre pestañas.
   - Modo FIREBASE: Firestore + Authentication (se activa al rellenar js/config.js).
   El resto de la app solo usa `db` y `auth`, así que no sabe en qué modo está. */
import { CONFIG, isDemo } from './config.js';
import { seedDemo } from './demo-seed.js';

const TS = () => ({ __ts: 1 });
const INC = (n) => ({ __inc: n });
const DEL = () => ({ __del: 1 });

// ---------- helpers comunes ----------
const getPathVal = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
function matches(doc, [f, op, v]) {
  const x = getPathVal(doc, f);
  switch (op) {
    case '==': return x === v; case '!=': return x !== v;
    case '<': return x < v; case '<=': return x <= v; case '>': return x > v; case '>=': return x >= v;
    case 'in': return Array.isArray(v) && v.includes(x);
    case 'array-contains': return Array.isArray(x) && x.includes(v);
    default: return false;
  }
}
function applyQuery(rows, { where = [], orderBy = [], limit } = {}) {
  let r = rows.filter((d) => where.every((w) => matches(d, w)));
  if (orderBy.length) {
    r = [...r].sort((a, b) => {
      for (const [f, dir = 'asc'] of orderBy) {
        const x = getPathVal(a, f), y = getPathVal(b, f);
        if (x === y) continue;
        const c = x == null ? -1 : y == null ? 1 : x < y ? -1 : 1;
        return dir === 'desc' ? -c : c;
      }
      return 0;
    });
  }
  return limit ? r.slice(0, limit) : r;
}
const isDocPath = (p) => p.split('/').length % 2 === 0;
const idOf = (p) => p.split('/').pop();
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(10))).map((b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');

// =====================================================================
//                              MODO DEMO
// =====================================================================
function createDemo() {
  const KEY = 'catas_demo_db_v2', AKEY = 'catas_demo_accounts_v2';
  let data = {};
  const listeners = new Set();
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('catas_demo') : null;

  const load = () => {
    try { const s = localStorage.getItem(KEY); data = s ? JSON.parse(s) : null; } catch { data = null; }
    if (!data) { data = seedDemo(); persist(false); }
  };
  const persist = (announce = true) => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* almacenamiento lleno */ }
    if (announce && bc) bc.postMessage('change');
  };
  const notify = () => listeners.forEach((l) => l());
  if (bc) bc.onmessage = () => { load(); notify(); };
  window.addEventListener('storage', (e) => { if (e.key === KEY) { load(); notify(); } });

  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  function resolve(incoming, existing = {}) {
    const out = {};
    for (const [k, v] of Object.entries(incoming)) {
      if (v === undefined) continue;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        if (v.__ts) out[k] = Date.now();
        else if (v.__inc != null) out[k] = (Number(existing[k]) || 0) + v.__inc;
        else if (v.__del) out[k] = undefined;
        else out[k] = resolve(v, existing[k] && typeof existing[k] === 'object' ? existing[k] : {});
      } else out[k] = clone(v);
    }
    return out;
  }
  function applyUpdate(base, patch) {
    const o = clone(base) || {};
    for (const [k, v] of Object.entries(patch)) {
      const parts = k.split('.');
      let cur = o;
      for (let i = 0; i < parts.length - 1; i++) { if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {}; cur = cur[parts[i]]; }
      const last = parts[parts.length - 1];
      const r = resolve({ [last]: v }, cur)[last];
      if (r === undefined) delete cur[last]; else cur[last] = r;
    }
    return o;
  }
  function deepMerge(a, b) {
    const o = { ...a };
    for (const [k, v] of Object.entries(b)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) o[k] = deepMerge(o[k], v);
      else if (v === undefined) delete o[k]; else o[k] = v;
    }
    return o;
  }
  const colDocs = (col) => {
    const pre = col + '/', out = [];
    for (const [k, v] of Object.entries(data)) if (k.startsWith(pre) && !k.slice(pre.length).includes('/')) out.push({ id: k.slice(pre.length), ...clone(v) });
    return out;
  };
  const read = (p) => (data[p] ? { id: idOf(p), ...clone(data[p]) } : null);
  const w = {
    set(p, d, opts = {}) { const incoming = resolve(d, data[p] || {}); data[p] = opts.merge && data[p] ? deepMerge(data[p], incoming) : incoming; },
    update(p, d) { if (!data[p]) throw new Error('not-found:' + p); data[p] = applyUpdate(data[p], d); },
    del(p) { delete data[p]; },
  };

  const api = {
    mode: 'demo',
    ts: TS, inc: INC, del: DEL,
    async get(p) { return read(p); },
    async set(p, d, o) { w.set(p, d, o); persist(); notify(); },
    async update(p, d) { w.update(p, d); persist(); notify(); },
    async del(p) { w.del(p); persist(); notify(); },
    async add(col, d) { const id = rid(); w.set(col + '/' + id, d); persist(); notify(); return id; },
    async list(col, q) { return applyQuery(colDocs(col), q); },
    async batch(ops) {
      for (const [op, p, d, o] of ops) { if (op === 'set') w.set(p, d, o); else if (op === 'update') w.update(p, d); else if (op === 'del') w.del(p); }
      persist(); notify();
    },
    async tx(fn) {
      const t = { get: async (p) => read(p), set: (p, d, o) => w.set(p, d, o), update: (p, d) => w.update(p, d), del: (p) => w.del(p) };
      const snapshot = clone(data);
      try { const r = await fn(t); persist(); notify(); return r; } catch (e) { data = snapshot; throw e; }
    },
    onDoc(p, cb) { return watch(() => read(p), cb); },
    onList(col, q, cb) { return watch(() => applyQuery(colDocs(col), q), cb); },
    reset() { data = seedDemo(); persist(); notify(); try { localStorage.removeItem(AKEY); } catch { /* nada */ } },
  };
  function watch(compute, cb) {
    let last = null;
    const run = () => { const v = compute(); const j = JSON.stringify(v); if (j !== last) { last = j; cb(v); } };
    const l = () => run(); listeners.add(l);
    setTimeout(run, 0);
    return () => listeners.delete(l);
  }
  load();

  // ----- autenticación de demo (una identidad por pestaña) -----
  const accounts = () => { try { return JSON.parse(localStorage.getItem(AKEY)) || seedAccounts(); } catch { return seedAccounts(); } };
  const saveAccounts = (a) => { try { localStorage.setItem(AKEY, JSON.stringify(a)); } catch { /* nada */ } };
  function seedAccounts() {
    const a = {
      'admin@demo.com': { uid: 'u_admin', pass: 'demo1234', name: 'Equip Demo' },
      'ana@demo.com': { uid: 'u_ana', pass: 'demo1234', name: 'Anna Demo' },
    };
    saveAccounts(a); return a;
  }
  let current = null; const authL = new Set();
  const emit = () => authL.forEach((f) => f(current));
  const setUser = (u) => { current = u; try { u ? sessionStorage.setItem('catas_demo_user', JSON.stringify(u)) : sessionStorage.removeItem('catas_demo_user'); } catch { /* nada */ } emit(); };
  try { current = JSON.parse(sessionStorage.getItem('catas_demo_user')); } catch { current = null; }
  const user = (email, a) => ({ uid: a.uid, email, name: a.name, anonymous: false });
  const auth = {
    get current() { return current; },
    onChange(cb) { authL.add(cb); setTimeout(() => cb(current), 0); return () => authL.delete(cb); },
    async signUp(email, pass, name) {
      const acc = accounts(); email = email.toLowerCase();
      if (acc[email]) throw Object.assign(new Error('exists'), { code: 'auth/email-already-in-use' });
      if (pass.length < 6) throw Object.assign(new Error('weak'), { code: 'auth/weak-password' });
      acc[email] = { uid: 'u_' + rid(), pass, name }; saveAccounts(acc); setUser(user(email, acc[email]));
    },
    async signIn(email, pass) {
      const acc = accounts(); email = email.toLowerCase();
      if (!acc[email] || acc[email].pass !== pass) throw Object.assign(new Error('bad'), { code: 'auth/invalid-credential' });
      setUser(user(email, acc[email]));
    },
    async provider(kind) {
      const acc = accounts(); const email = `demo.${kind}@demo.com`;
      if (!acc[email]) { acc[email] = { uid: 'u_' + kind, pass: rid(), name: kind === 'google' ? 'Usuario Google' : 'Usuario Apple' }; saveAccounts(acc); }
      setUser({ ...user(email, acc[email]), provider: kind });
    },
    async anonymous() { setUser({ uid: 'anon_' + rid(), email: null, name: '', anonymous: true }); },
    async signOut() { setUser(null); },
    async reset() { /* en la demo no se envía ningún correo */ },
  };
  return { db: api, auth };
}

// =====================================================================
//                             MODO FIREBASE
// =====================================================================
async function createFirebase() {
  const base = `https://www.gstatic.com/firebasejs/${CONFIG.firebaseSdkVersion}`;
  const [{ initializeApp }, A, F] = await Promise.all([import(`${base}/firebase-app.js`), import(`${base}/firebase-auth.js`), import(`${base}/firebase-firestore.js`)]);
  const app = initializeApp(CONFIG.firebase);
  const fa = A.getAuth(app);
  const fs = F.initializeFirestore(app, { ignoreUndefinedProperties: true, experimentalAutoDetectLongPolling: true });

  const ref = (p) => F.doc(fs, ...p.split('/'));
  const colRef = (p) => F.collection(fs, ...p.split('/'));
  const conv = (v) => {
    if (v && typeof v === 'object') {
      if (typeof v.toMillis === 'function') return v.toMillis();
      if (Array.isArray(v)) return v.map(conv);
      const o = {}; for (const [k, x] of Object.entries(v)) o[k] = conv(x); return o;
    }
    return v;
  };
  const norm = (s) => (s.exists() ? { id: s.id, ...conv(s.data({ serverTimestamps: 'estimate' })) } : null);
  const prep = (v) => {
    if (v && typeof v === 'object') {
      if (v.__ts) return F.serverTimestamp();
      if (v.__inc != null) return F.increment(v.__inc);
      if (v.__del) return F.deleteField();
      if (Array.isArray(v)) return v.map(prep);
      const o = {}; for (const [k, x] of Object.entries(v)) if (x !== undefined) o[k] = prep(x); return o;
    }
    return v;
  };
  const build = (col, q = {}) => (q.where || []).length ? F.query(colRef(col), ...q.where.map(([f, op, v]) => F.where(f, op, v))) : colRef(col);
  const post = (rows, q) => applyQuery(rows, { orderBy: q?.orderBy, limit: q?.limit });
  const onErr = (e) => { console.error(e); window.dispatchEvent(new CustomEvent('db-error', { detail: e })); };

  const api = {
    mode: 'firebase',
    ts: TS, inc: INC, del: DEL,
    async get(p) { return norm(await F.getDoc(ref(p))); },
    async set(p, d, o) { await F.setDoc(ref(p), prep(d), o || {}); },
    async update(p, d) { await F.updateDoc(ref(p), prep(d)); },
    async del(p) { await F.deleteDoc(ref(p)); },
    async add(col, d) { const r = await F.addDoc(colRef(col), prep(d)); return r.id; },
    async list(col, q) { const s = await F.getDocs(build(col, q)); return post(s.docs.map(norm), q); },
    async batch(ops) {
      const b = F.writeBatch(fs);
      for (const [op, p, d, o] of ops) { if (op === 'set') b.set(ref(p), prep(d), o || {}); else if (op === 'update') b.update(ref(p), prep(d)); else if (op === 'del') b.delete(ref(p)); }
      await b.commit();
    },
    async tx(fn) {
      return F.runTransaction(fs, (t) => fn({
        get: async (p) => norm(await t.get(ref(p))),
        set: (p, d, o) => t.set(ref(p), prep(d), o || {}),
        update: (p, d) => t.update(ref(p), prep(d)),
        del: (p) => t.delete(ref(p)),
      }));
    },
    onDoc(p, cb) { return F.onSnapshot(ref(p), (s) => cb(norm(s)), onErr); },
    onList(col, q, cb) { return F.onSnapshot(build(col, q), (s) => cb(post(s.docs.map(norm), q)), onErr); },
  };

  const mapUser = (u) => (u ? { uid: u.uid, email: u.email, name: u.displayName || '', anonymous: u.isAnonymous, provider: u.providerData?.[0]?.providerId } : null);
  let current = null, firstEmit = false; const authL = new Set();
  A.onAuthStateChanged(fa, (u) => { current = mapUser(u); firstEmit = true; authL.forEach((f) => f(current)); });
  A.getRedirectResult(fa).catch(onErr);
  const popup = async (prov) => {
    try { await A.signInWithPopup(fa, prov); }
    catch (e) {
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported'].includes(e.code)) return A.signInWithRedirect(fa, prov);
      throw e;
    }
  };
  const auth = {
    get current() { return current; },
    onChange(cb) { authL.add(cb); if (firstEmit) setTimeout(() => cb(current), 0); return () => authL.delete(cb); },
    async signUp(email, pass, name) { const c = await A.createUserWithEmailAndPassword(fa, email, pass); if (name) await A.updateProfile(c.user, { displayName: name }); current = mapUser(fa.currentUser); authL.forEach((f) => f(current)); },
    async signIn(email, pass) { await A.signInWithEmailAndPassword(fa, email, pass); },
    async provider(kind) {
      if (kind === 'google') return popup(new A.GoogleAuthProvider());
      const p = new A.OAuthProvider('apple.com'); p.addScope('email'); p.addScope('name'); return popup(p);
    },
    async anonymous() { await A.signInAnonymously(fa); },
    async signOut() { await A.signOut(fa); },
    async reset(email) { await A.sendPasswordResetEmail(fa, email); },
  };
  return { db: api, auth };
}

// ---------- arranque ----------
export let db, auth;
export const mode = () => (isDemo() ? 'demo' : 'firebase');
export async function initStore() {
  const s = isDemo() ? createDemo() : await createFirebase();
  db = s.db; auth = s.auth;
  return s;
}
