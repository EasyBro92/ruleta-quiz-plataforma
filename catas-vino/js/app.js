/* Arranque, enrutador y estructura general (barra superior + navegación) */
import { CONFIG, isDemo } from './config.js';
import { initStore, db, auth } from './store.js';
import { S, bus, go } from './state.js';
import { loadLang, t } from './i18n.js';
import { html, setHtml, on, toast, modal, setLocale, formData, raw, esc } from './util.js';
import { icon } from './icons.js';

// ---------- rutas: [patrón, vista, opciones] ----------
const ROUTES = [
  ['/', 'catas', { nav: 'home', cover: true }],
  ['/cata/:id', 'cata', { nav: 'home' }],
  ['/mine', 'mine', { nav: 'mine' }],
  ['/private', 'private', { nav: 'home' }],
  ['/play', 'join', { nav: 'play' }],
  ['/join/:code', 'join', { nav: 'play' }],
  ['/game/:sid', 'game', { chrome: false }],
  ['/screen/:code', 'screen', { chrome: false }],
  ['/ranking', 'ranking', { nav: 'ranking' }],
  ['/me', 'me', { nav: 'me' }],
  ['/notices', 'notices', { nav: 'me' }],
  ['/login', 'login', { nav: 'me' }],
  ['/admin', 'admin/catas', { staff: true, wide: true, nav: 'admin' }],
  ['/admin/cata/:id', 'admin/cata', { staff: true, wide: true, nav: 'admin' }],
  ['/admin/private', 'admin/private', { staff: true, wide: true, nav: 'admin' }],
  ['/admin/wines', 'admin/wines', { staff: true, wide: true, nav: 'admin' }],
  ['/admin/questions', 'admin/questions', { staff: true, wide: true, nav: 'admin' }],
  ['/admin/games', 'admin/games', { staff: true, wide: true, nav: 'admin' }],
  ['/admin/run/:sid', 'admin/run', { staff: true, wide: true, nav: 'admin' }],
  ['/admin/rewards', 'admin/rewards', { staff: true, wide: true, nav: 'admin' }],
  ['/admin/team', 'admin/team', { staff: true, wide: true, nav: 'admin', adminOnly: true }],
];
const compile = (p) => new RegExp('^' + p.replace(/:[a-z]+/g, '([^/]+)') + '/?$');
const COMPILED = ROUTES.map(([p, v, o]) => ({ re: compile(p), names: [...p.matchAll(/:([a-z]+)/g)].map((m) => m[1]), view: v, opts: o || {} }));

let cleanup = null, token = 0, chromeMode = null, lastKey = null;
const app = () => document.getElementById('app');

// ---------- estructura ----------
function navItems() {
  const items = [
    ['home', '/', 'glass', t('nav.catas')], ['play', '/play', 'dice', t('nav.play')], ['mine', '/mine', 'calendar', t('nav.mine')],
    ['ranking', '/ranking', 'trophy', t('nav.ranking')], ['me', '/me', 'user', t('nav.me')],
  ];
  if (S.staff) items.push(['admin', '/admin', 'sliders', t('nav.admin')]);
  return items;
}
function renderShell(chrome, wide, nav) {
  const lang = CONFIG.languages.map(([c, n]) => `<option value="${c}" ${c === S.lang ? 'selected' : ''}>${esc(n)}</option>`).join('');
  if (!chrome) { setHtml(app(), html`<main class="full" id="view"></main>`); chromeMode = 'none'; return; }
  const demo = isDemo() ? html`<div class="demo-bar">${t('demo.bar')} · <a href="#" data-act="demo-info">${t('demo.accounts')}</a> · <a href="#" data-act="demo-reset">${t('demo.reset')}</a></div>` : '';
  setHtml(app(), html`${demo}
    <header class="topbar">
      <a class="brand" href="#/" aria-label="${CONFIG.brand.name}">${CONFIG.brand.logo ? html`<img src="${CONFIG.brand.logo}" alt="" data-brand-logo>` : html`${icon('glass', 22, 1.5)}<span>${CONFIG.brand.name}</span>`}</a>
      <span class="grow"></span>
      <select id="lang" aria-label="${t('a11y.lang')}">${raw(lang)}</select>
      ${S.user && !S.user.anonymous ? html`<a class="icon-btn" href="#/notices" aria-label="${t('nav.notices')}">${icon('bell', 19)}${S.unread ? html`<span class="dot"></span>` : ''}</a>` : ''}
    </header>
    <main id="view" class="${wide ? 'wide' : ''}"></main>
    <nav class="nav" aria-label="${t('a11y.nav')}">${navItems().map(([k, h, ic, l]) => html`<a href="#${h}" data-nav="${k}" class="${k === nav ? 'on' : ''}">${icon(ic, 22)}${l}</a>`)}</nav>`);
  chromeMode = 'full';
  // si el logo no carga, se enseña el icono con el nombre
  document.querySelector('img[data-brand-logo]')?.addEventListener('error', (e) => { e.target.closest('.brand').innerHTML = `${icon('glass', 22, 1.5)}<span>${esc(CONFIG.brand.name)}</span>`; }, { once: true });
}
function markNav(nav, wide) {
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.nav === nav));
  const m = document.querySelector('main'); if (m) m.classList.toggle('wide', !!wide);
}
function refreshBell() {
  const b = document.querySelector('.topbar a.icon-btn');
  if (b) { const d = b.querySelector('.dot'); if (S.unread && !d) b.insertAdjacentHTML('beforeend', '<span class="dot"></span>'); if (!S.unread && d) d.remove(); }
}

// ---------- pantalla de apertura ----------
// El logo se ve al menos ~1,3 s desde que se abre la app y se desvanece cuando ya está todo listo.
let splashDone = false;
function hideSplash() {
  if (splashDone) return; splashDone = true;
  const el = document.getElementById('splash'); if (!el) return;
  if (navigator.webdriver) { el.remove(); return; }             // pruebas automáticas: sin espera
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 550); }, Math.max(0, 1300 - performance.now()));
}

// ---------- enrutado ----------
async function route() {
  const my = ++token;
  cleanup && (await Promise.resolve(cleanup())); cleanup = null;
  const full = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = full.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  let hit = null, params = {};
  for (const r of COMPILED) { const m = path.match(r.re); if (m) { hit = r; r.names.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1]))); break; } }
  if (!hit) { go('/'); return; }
  if (hit.opts.staff && !S.staff) { if (!S.user || S.user.anonymous) { go('/login?next=' + encodeURIComponent(full)); } else { toast(t('err.noaccess'), 'err'); go('/'); } return; }
  if (hit.opts.adminOnly && S.staff !== 'admin') { toast(t('err.noaccess'), 'err'); go('/admin'); return; }
  const chrome = hit.opts.chrome !== false;
  document.body.classList.toggle('is-cover', !!hit.opts.cover && chrome);
  if (chromeMode !== (chrome ? 'full' : 'none') || !document.getElementById('view')) renderShell(chrome, hit.opts.wide, hit.opts.nav); else if (chrome) markNav(hit.opts.nav, hit.opts.wide);
  const el = document.getElementById('view');
  window.scrollTo(0, 0);
  el.classList.remove('view-in'); void el.offsetWidth; el.classList.add('view-in');      // transición suave entre pantallas
  try {
    const mod = await import(`./views/${hit.view}.js`);
    if (my !== token) return;
    cleanup = await mod.default({ el, params, query, path: full });
  } catch (e) {
    console.error(e);
    if (my === token) setHtml(el, html`<div class="card"><h3>${t('err.generic')}</h3><p class="muted small">${String(e.message || e)}</p><a class="btn" href="#/">${t('common.home')}</a></div>`);
  }
  if (my === token) hideSplash();
}

// ---------- autenticación y perfil ----------
let unsubs = [];
async function createProfile(u) {
  const pend = S.pendingProfile; S.pendingProfile = null;
  const base = { uid: u.uid, name: pend?.name || u.name || '', nick: pend?.nick || (u.name || u.email || '').split(/[ @]/)[0], email: u.email || '', phone: pend?.phone || '', allergies: pend?.allergies || '', lang: S.lang, adult: !!pend, createdAt: db.ts() };
  await db.set(`users/${u.uid}`, base);
  return base;
}
function askAdult(p) {
  const m = modal(html`<h2>${t('welcome.title')}</h2><p class="muted">${t('welcome.text')}</p>
    <form id="adultForm">
      <label class="field"><span>${t('f.name')}</span><input name="name" required value="${p.name}"></label>
      <label class="field"><span>${t('f.nick')}</span><input name="nick" required maxlength="18" value="${p.nick}"></label>
      <label class="field"><span>${t('f.phone')}</span><input name="phone" type="tel" value="${p.phone || ''}"></label>
      <label class="check"><input type="checkbox" name="adult" required><span>${t('age.confirm', { n: CONFIG.minAge })}</span></label>
      <p class="hint">${t('age.local')}</p>
      <button class="btn primary block" type="submit">${t('common.continue')}</button>
      <button class="btn ghost block mt" type="button" data-out>${t('auth.logout')}</button>
    </form>`);
  m.el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = formData(e.target); if (!f.adult) return;
    await db.update(`users/${p.uid}`, { name: f.name, nick: f.nick, phone: f.phone, adult: true });
    m.close();
  });
  m.el.querySelector('[data-out]').addEventListener('click', () => { m.close(); auth.signOut(); });
}
function onAuth(u) {
  unsubs.forEach((f) => f()); unsubs = [];
  const prevKey = lastKey;
  S.user = u; S.profile = null; S.staff = null; S.unread = 0;
  const finish = () => {
    const key = (S.user?.uid || '-') + ':' + (S.staff || '-');
    if (key === lastKey) { refreshBell(); return; }
    lastKey = key; bus.emit('auth', S.user);
    if (chromeMode === 'full') { const v = document.getElementById('view'); if (v) { /* se vuelve a pintar todo */ } }
    chromeMode = null; route();
  };
  if (!u || u.anonymous) { lastKey = null; finish(); return; }
  let gotP = false, gotS = false, asked = false;
  const done = () => { if (gotP && gotS) finish(); };
  unsubs.push(db.onDoc(`users/${u.uid}`, async (p) => {
    if (!p) { if (!gotP) { try { p = await createProfile(u); } catch (e) { console.error(e); } } else return; }
    S.profile = p; if (p?.lang && !gotP && localStorage.getItem('catas_lang') == null && CONFIG.languages.some(([c]) => c === p.lang)) setLang(p.lang, false);
    if (p && !p.adult && !asked) { asked = true; askAdult({ ...p, uid: u.uid }); }
    gotP = true; bus.emit('profile', p); done();
  }));
  unsubs.push(db.onDoc(`staff/${u.uid}`, (s) => { S.staff = s?.role || null; gotS = true; done(); }));
  unsubs.push(db.onList(`users/${u.uid}/notices`, { where: [['read', '==', false]] }, (l) => { S.unread = l.length; refreshBell(); }));
  void prevKey;
}

// ---------- idioma ----------
async function setLang(l, rerender = true) {
  S.lang = l; try { localStorage.setItem('catas_lang', l); } catch { /* nada */ }
  await loadLang(l); setLocale(l); document.documentElement.lang = l;
  if (rerender) { chromeMode = null; route(); }
}

// ---------- eventos globales ----------
function bindGlobal() {
  window.addEventListener('hashchange', route);
  document.addEventListener('change', (e) => { if (e.target.id === 'lang') { setLang(e.target.value); if (S.user && !S.user.anonymous && S.profile) db.update(`users/${S.user.uid}`, { lang: e.target.value }).catch(() => {}); } });
  document.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'demo-reset') { e.preventDefault(); db.reset(); await auth.signOut(); toast(t('demo.restored')); go('/'); }
    if (a.dataset.act === 'demo-info') { e.preventDefault(); modal(html`<h3>${t('demo.accounts')}</h3><p><b>${t('demo.admin')}</b><br>admin@demo.com · demo1234</p><p><b>${t('demo.client')}</b><br>ana@demo.com · demo1234</p><p class="muted small">${t('demo.note')}</p><button class="btn block" data-close>${t('common.ok')}</button>`); }
  });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installEvent = e; bus.emit('install'); });
  window.addEventListener('db-error', (e) => { const c = e.detail?.code || ''; toast(c === 'permission-denied' ? t('err.noaccess') : t('err.generic'), 'err'); });
  window.addEventListener('unhandledrejection', (e) => { const c = e.reason?.code || ''; if (c === 'permission-denied') { toast(t('err.noaccess'), 'err'); } });
}

// ---------- inicio ----------
async function main() {
  let lang = null;
  try { lang = localStorage.getItem('catas_lang'); } catch { /* nada */ }
  if (!lang) {
    const nav = (navigator.language || CONFIG.defaultLang).slice(0, 2);
    lang = CONFIG.languages.some(([c]) => c === nav) && !(CONFIG.noAutoLang || []).includes(nav) ? nav : CONFIG.defaultLang;
  }
  S.lang = lang; await loadLang(lang); setLocale(lang); document.documentElement.lang = lang;
  try { await initStore(); } catch (e) { console.error(e); setHtml(app(), html`<div class="card" style="margin:20px"><h3>${t('err.connect')}</h3><p class="muted">${String(e.message || e)}</p></div>`); hideSplash(); return; }
  bindGlobal();
  try { if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {}); } catch { /* sin service worker (p. ej. dentro de un visor) */ }
  auth.onChange(onAuth);
}
main();
