/* Avisos personales y novedades del negocio */
import { db } from '../store.js';
import { S, loggedIn } from '../state.js';
import { t } from '../i18n.js';
import { html, setHtml, fmtDateTime, fmtDate, fromIsoDay, fmtShortDate } from '../util.js';

const params = (n) => {
  const d = n.data || {};
  return { title: d.title || '', date: d.date ? (typeof d.date === 'number' ? fmtDateTime(d.date) : fmtDate(fromIsoDay(d.date))) : '', note: d.note || '', counter: d.counterDate ? fmtDate(fromIsoDay(d.counterDate)) : '' };
};

export default function view({ el }) {
  if (!loggedIn()) { setHtml(el, html`<div class="card center"><p>${t('mine.login')}</p><a class="btn primary" href="#/login?next=%2Fnotices">${t('auth.loginOrSignup')}</a></div>`); return; }
  let list = null, news = null, marked = false;
  const render = () => setHtml(el, html`<h1>${t('nav.notices')}</h1>
    ${list === null ? html`<div class="empty">…</div>` : list.length ? html`<div class="stack">${list.map((n) => html`<a class="card cata" style="${n.read ? 'opacity:.7' : ''}" href="#${n.link || '/'}"><span style="font-size:1.5rem">${n.read ? '✉️' : '🔔'}</span><div class="grow"><div>${t('notice.' + n.type, params(n))}</div><div class="small muted">${n.createdAt ? fmtDateTime(n.createdAt) : ''}</div></div></a>`)}</div>` : html`<div class="card empty"><span class="big">🔕</span>${t('notice.none')}</div>`}
    ${news && news.length ? html`<h2 class="mt2">${t('notice.news')}</h2><div class="stack">${news.map((a) => html`<div class="card"><h3>${a.title}</h3><p class="muted small" style="margin:0">${a.body}</p><div class="small muted mt">${a.createdAt ? fmtShortDate(a.createdAt) : ''}</div></div>`)}</div>` : ''}`);
  const u1 = db.onList(`users/${S.user.uid}/notices`, { orderBy: [['createdAt', 'desc']], limit: 40 }, async (l) => {
    list = l; render();
    if (!marked) { marked = true; const unread = l.filter((n) => !n.read); if (unread.length) setTimeout(() => db.batch(unread.map((n) => ['update', `users/${S.user.uid}/notices/${n.id}`, { read: true }])).catch(() => {}), 1200); }
  });
  const u2 = db.onList('announcements', { orderBy: [['createdAt', 'desc']], limit: 10 }, (l) => { news = l; render(); });
  render();
  return () => { u1(); u2(); };
}
