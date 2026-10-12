/* Mis reservas y solicitudes de cata privada */
import { db } from '../store.js';
import { S, loggedIn } from '../state.js';
import { t } from '../i18n.js';
import { html, setHtml, fmtDateTime, fmtDate, fromIsoDay } from '../util.js';
import { icon } from '../icons.js';

export default function view({ el }) {
  if (!loggedIn()) { setHtml(el, html`<div class="card center"><span class="big-ic">${icon('calendar', 34, 1.3)}</span><p>${t('mine.login')}</p><a class="btn primary" href="#/login?next=%2Fmine">${t('auth.loginOrSignup')}</a></div>`); return; }
  let books = null, reqs = null;
  const render = () => {
    const now = Date.now();
    const valid = (books || []).filter((b) => b.startsAt && b.title);
    const up = valid.filter((b) => b.startsAt >= now - 3 * 3600000 && b.status !== 'cancelled').sort((a, b) => a.startsAt - b.startsAt);
    const past = valid.filter((b) => b.startsAt < now - 3 * 3600000 || b.status === 'cancelled').sort((a, b) => b.startsAt - a.startsAt);
    const soon = up.filter((b) => b.status === 'confirmed' && b.startsAt - now < 48 * 3600000);
    const row = (b) => html`<a class="card cata" href="#/cata/${b.cataId}"><div class="grow"><h3>${b.title}</h3><div class="meta"><span>${icon('calendar', 15)}${fmtDateTime(b.startsAt)}</span><span>${icon('users', 15)}${t('book.seats', { n: b.seats })}</span></div></div>
      <span class="pill ${b.status === 'confirmed' ? 'ok' : b.status === 'waitlist' ? 'warn' : 'bad'}">${t('status.' + b.status)}</span></a>`;
    setHtml(el, html`
      <h1>${t('nav.mine')}</h1>
      ${soon.map((b) => html`<div class="note mb">⏰ ${t('mine.reminder', { title: b.title, date: fmtDateTime(b.startsAt) })}</div>`)}
      ${books === null ? html`<div class="empty">…</div>` : up.length ? html`<div class="stack">${up.map(row)}</div>` : html`<div class="card empty"><span class="big-ic">${icon('glass', 34, 1.3)}</span>${t('mine.none')}<div class="mt"><a class="btn primary" href="#/">${t('home.upcoming')}</a></div></div>`}
      <div class="row between mt2"><h2 style="margin:0">${t('mine.private')}</h2><a class="btn sm" href="#/private">${t('home.private')}</a></div>
      <div class="stack mt">${(reqs || []).length ? reqs.map((r) => html`<div class="card"><div class="row between"><b>${fmtDate(fromIsoDay(r.date))} · ${r.time}</b><span class="pill ${r.status === 'accepted' ? 'ok' : r.status === 'rejected' ? 'bad' : 'warn'}">${t('preq.' + r.status)}</span></div>
        <div class="meta"><span>${icon('users', 15)}${r.people}</span><span>${icon('pin', 15)}${r.place}</span></div>
        ${r.status === 'counter' ? html`<div class="note mt">${t('preq.counterText', { d: r.counterDate ? fmtDate(fromIsoDay(r.counterDate)) : '' })} ${r.counterNote || ''}</div>` : r.counterNote ? html`<p class="muted small mt">${r.counterNote}</p>` : ''}</div>`) : html`<div class="muted small">${t('mine.noPrivate')}</div>`}</div>
      ${past.length ? html`<h2 class="mt2">${t('mine.past')}</h2><div class="stack">${past.map(row)}</div>` : ''}
    `);
  };
  const u1 = db.onList(`users/${S.user.uid}/bookings`, {}, (r) => { books = r; render(); });
  const u2 = db.onList('privateRequests', { where: [['uid', '==', S.user.uid]], orderBy: [['createdAt', 'desc']] }, (r) => { reqs = r; render(); });
  render();
  return () => { u1(); u2(); };
}
