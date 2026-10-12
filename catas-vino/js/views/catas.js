/* Inicio: portada (logo, foto y presentación), calendario mensual y próximos tasts */
import { db } from '../store.js';
import { S, bus } from '../state.js';
import { t } from '../i18n.js';
import { CONFIG } from '../config.js';
import { html, setHtml, fmtDate, fmtTime, dayNum, monthShort, money, isoDay, fromIsoDay } from '../util.js';
import { seatsLeft, isFull, isPast } from '../api.js';
import { icon, portraitPlaceholder } from '../icons.js';
import { contactBlock } from '../contact.js';

export const cataCard = (c) => {
  const left = seatsLeft(c), pct = c.capacity ? Math.min(100, Math.round(((c.seatsTaken || 0) / c.capacity) * 100)) : 0;
  return html`<a class="card cata" href="#/cata/${c.id}">
    <div class="date"><b>${dayNum(c.startsAt)}</b><span>${monthShort(c.startsAt)}</span></div>
    <div class="grow">
      <h3>${c.title}</h3>
      <div class="meta"><span>${icon('clock', 15)}${fmtTime(c.startsAt)}</span><span>${icon('pin', 15)}${c.address || '—'}</span><span>${icon('euro', 15)}${money(c.price)}</span></div>
      <div class="seatbar"><i style="width:${pct}%"></i></div>
      <div class="row between small" style="margin-top:6px"><span class="muted">${isFull(c) ? t('cata.full') : t('cata.left', { n: left })}</span>${isFull(c) ? html`<span class="pill warn">${t('cata.waitlist')}</span>` : ''}</div>
    </div></a>`;
};

export function installBanner() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone && !matchMedia('(display-mode: standalone)').matches;
  if (S.installEvent) return html`<div class="install">${icon('download', 24)}<span class="grow">${t('install.text')}</span><button class="btn sm gold" data-act="install">${t('install.btn')}</button></div>`;
  if (ios) return html`<div class="install">${icon('download', 24)}<span class="grow">${t('install.ios')}</span></div>`;
  return '';
}

// si el logo o la foto no cargan (p. ej. sin conexión), se enseña el marcador en vez de una imagen rota
const brokenImg = new Set();

/** Portada: el logo y tu foto, y debajo la presentación. */
function cover() {
  const b = CONFIG.brand, logo = b.logo && !brokenImg.has('logo'), photo = b.photo && !brokenImg.has('photo');
  return html`<section class="cover">
    <div class="cover-logo">
      ${logo ? html`<img src="${b.logo}" alt="" data-brand="logo">` : icon('glass', 38, 1.3)}
      <h1 class="${logo ? 'sr-only' : ''}">${b.name}</h1>
    </div>
    <div class="arch"><div class="frame">${photo ? html`<img src="${b.photo}" alt="${b.owner || b.name}" data-brand="photo">` : html`<div class="ph">${portraitPlaceholder()}${b.photo ? '' : html`<span>${t('home.photoPh')}</span>`}</div>`}</div></div>
    ${b.owner ? html`<p class="owner">${b.owner}</p>` : ''}
    <p class="intro">${b.intro || t('home.intro')}</p>
    <div class="cover-cta"><button class="btn primary" data-act="to-calendar">${t('home.book')} ${icon('down', 18)}</button></div>
  </section>`;
}

const keyOf = (ms) => isoDay(ms);

export default function view({ el }) {
  let catas = null, news = null, month = null, selDay = '';
  const lang = () => S.lang || 'ca';

  const upcoming = () => (catas || []).filter((c) => !isPast(c) || c.startsAt > Date.now() - 3600000).sort((a, b) => a.startsAt - b.startsAt);

  function calendar(list) {
    const now = new Date();
    const todayKey = keyOf(now.getTime());
    const first = new Date(month.y, month.m, 1);
    const lead = (first.getDay() + 6) % 7;                       // la semana empieza en lunes
    const days = new Date(month.y, month.m + 1, 0).getDate();
    const byDay = new Map();
    list.forEach((c) => { const k = keyOf(c.startsAt); byDay.set(k, [...(byDay.get(k) || []), c]); });
    const wd = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(lang(), { weekday: 'narrow' }).format(new Date(2024, 0, 1 + i)));
    const raw0 = new Intl.DateTimeFormat(lang(), { month: 'long', year: 'numeric' }).format(first);
    const label = raw0.charAt(0).toLocaleUpperCase(lang()) + raw0.slice(1);
    const thisMonth = now.getFullYear() * 12 + now.getMonth();
    const cur = month.y * 12 + month.m;
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(html`<div></div>`);
    for (let d = 1; d <= days; d++) {
      const date = new Date(month.y, month.m, d), k = keyOf(date.getTime()), here = byDay.get(k);
      const cls = ['day', k < todayKey ? 'off' : '', k === todayKey ? 'today' : ''];
      if (here) {
        const full = here.every(isFull);
        cls.push('has', full ? 'full' : '', k === selDay ? 'sel' : '');
        cells.push(html`<button type="button" class="${cls.filter(Boolean).join(' ')}" data-day="${k}" aria-pressed="${k === selDay}" aria-label="${fmtDate(date.getTime(), { day: 'numeric', month: 'long' })} · ${here.map((c) => c.title).join(', ')}">${d}</button>`);
      } else cells.push(html`<div class="${cls.filter(Boolean).join(' ')}">${d}</div>`);
    }
    return html`<div class="mcal">
      <div class="mcal-head"><h3>${label}</h3>
        <div class="mcal-nav"><button type="button" data-month="-1" aria-label="${t('cal.prev')}" ${cur <= thisMonth ? 'disabled' : ''}>${icon('left', 18)}</button><button type="button" data-month="1" aria-label="${t('cal.next')}" ${cur >= thisMonth + 11 ? 'disabled' : ''}>${icon('right', 18)}</button></div></div>
      <div class="mcal-grid">${wd.map((w) => html`<div class="wd">${w}</div>`)}${cells}</div>
      <div class="legend"><span><i></i>${t('cal.legendFree')}</span><span><i class="o"></i>${t('cal.legendFull')}</span></div>
    </div>`;
  }

  const render = () => {
    const list = upcoming();
    if (catas && !month) { const f = list[0] ? new Date(list[0].startsAt) : new Date(); month = { y: f.getFullYear(), m: f.getMonth() }; }
    const shown = selDay ? list.filter((c) => keyOf(c.startsAt) === selDay) : list;
    const selDate = selDay ? fromIsoDay(selDay) : 0;
    setHtml(el, html`
      ${cover()}
      <section class="sect" id="calendario">
        <h2>${t('home.upcoming')}</h2>
        ${month ? calendar(list) : html`<div class="empty">…</div>`}
        ${selDay ? html`<div class="list-head"><h3>${t('cal.day', { d: fmtDate(selDate, { weekday: 'long', day: 'numeric', month: 'long' }) })}</h3><span class="filter">${t('cal.all')}<button type="button" data-act="clear-day" aria-label="${t('cal.all')}">×</button></span></div>` : html`<div class="mt2"></div>`}
        ${catas === null ? '' : shown.length ? html`<div class="grid auto">${shown.map(cataCard)}</div>` : html`<div class="card empty">${t('home.none')}</div>`}
      </section>
      ${news ? html`<section class="sect"><div class="news">${icon('megaphone', 22)}<div><h3>${news.title}</h3><p class="muted small" style="margin:0">${news.body}</p></div></div></section>` : ''}
      <section class="sect"><div class="private-cta"><h3>${t('home.privateTitle')}</h3><p>${t('home.privateText')}</p><div class="cta-row"><a class="btn primary" href="#/private">${t('home.private')}</a></div><div class="cta-contact">${contactBlock()}</div></div></section>
      <div class="sect">${installBanner()}</div>
    `);
    el.querySelectorAll('img[data-brand]').forEach((img) => img.addEventListener('error', () => { brokenImg.add(img.dataset.brand); render(); }, { once: true }));
  };

  const u1 = db.onList('catas', { where: [['published', '==', true]] }, (r) => { catas = r; render(); });
  const u2 = db.onList('announcements', { orderBy: [['createdAt', 'desc']], limit: 1 }, (r) => { news = r[0] || null; render(); });
  const u3 = bus.on('install', render);
  const click = async (e) => {
    const tgt = e.target;
    if (tgt.closest('[data-act="install"]') && S.installEvent) { S.installEvent.prompt(); await S.installEvent.userChoice.catch(() => {}); S.installEvent = null; render(); return; }
    if (tgt.closest('[data-act="to-calendar"]')) { const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; el.querySelector('#calendario')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); return; }
    const mb = tgt.closest('[data-month]');
    if (mb && month) { const d = new Date(month.y, month.m + Number(mb.dataset.month), 1); month = { y: d.getFullYear(), m: d.getMonth() }; selDay = ''; render(); return; }
    const db_ = tgt.closest('[data-day]');
    if (db_) { selDay = selDay === db_.dataset.day ? '' : db_.dataset.day; render(); return; }
    if (tgt.closest('[data-act="clear-day"]')) { selDay = ''; render(); }
  };
  el.addEventListener('click', click);
  render();
  return () => { u1(); u2(); u3(); el.removeEventListener('click', click); };
}
