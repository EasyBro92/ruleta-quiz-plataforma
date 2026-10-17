/* Inicio: portada (logo, foto y presentación), calendario mensual y próximos tasts */
import { db } from '../store.js';
import { S, bus } from '../state.js';
import { t } from '../i18n.js';
import { CONFIG } from '../config.js';
import { html, setHtml, fmtDate, fmtTime, dayNum, monthShort, money, isoDay, fromIsoDay, skeleton, modal } from '../util.js';
import { countdown } from '../countdown.js';
import { seatsLeft, isFull, isPast } from '../api.js';
import { icon, portraitPlaceholder } from '../icons.js';
import { contactBlock } from '../contact.js';

export const cataCard = (c) => {
  const left = seatsLeft(c), pct = c.capacity ? Math.min(100, Math.round(((c.seatsTaken || 0) / c.capacity) * 100)) : 0;
  const cd = countdown(c.startsAt, c.durationMin);
  return html`<a class="card cata ${c.image ? 'has-photo' : ''}" href="#/cata/${c.id}">
    ${c.image ? html`<div class="cata-photo"><img src="${c.image}" alt="" loading="lazy"></div>` : ''}
    <div class="date"><b>${dayNum(c.startsAt)}</b><span>${monthShort(c.startsAt)}</span></div>
    <div class="grow">
      ${cd ? html`<span class="cd">${cd}</span>` : ''}
      <h3>${c.title}</h3>
      <div class="meta"><span>${icon('clock', 15)}${fmtTime(c.startsAt)}</span><span>${icon('pin', 15)}${c.address || '—'}</span><span>${icon('euro', 15)}${money(c.price)}</span></div>
      <div class="seatbar"><i style="width:${pct}%"></i></div>
      <div class="row between small" style="margin-top:6px"><span class="muted">${isFull(c) ? t('cata.full') : t('cata.left', { n: left })}</span>${isFull(c) ? html`<span class="pill warn">${t('cata.waitlist')}</span>` : ''}</div>
    </div></a>`;
};

/** Tarjetas deslizables: se arrastran con el dedo (o con las flechas en el ordenador). */
const carousel = (items) => html`<div class="car">
  <div class="car-track" data-car-track>${items.map((c) => html`<div class="car-item">${cataCard(c)}</div>`)}</div>
  ${items.length > 1 ? html`<div class="car-ui">
    <button type="button" class="car-btn" data-car-go="-1" aria-label="${t('home.carPrev')}">${icon('left', 18)}</button>
    ${items.length <= 7
      ? html`<div class="car-dots">${items.map((_, i) => html`<button type="button" data-car-dot="${i}" aria-label="${t('home.carGo', { n: i + 1, total: items.length })}"></button>`)}</div>`
      : html`<span class="car-count" data-car-count>1 / ${items.length}</span>`}
    <button type="button" class="car-btn" data-car-go="1" aria-label="${t('home.carNext')}">${icon('right', 18)}</button>
  </div>` : ''}
</div>`;

/** Posición de la tarjeta visible según el scroll del carrusel. */
const carIndex = (track) => {
  const items = track.children, n = items.length;
  if (n < 2) return 0;
  if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 4) return n - 1;
  const step = items[1].offsetLeft - items[0].offsetLeft;
  return Math.max(0, Math.min(n - 1, Math.round(track.scrollLeft / step)));
};
const carScrollTo = (track, i) => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = track.children, left = items[Math.max(0, Math.min(items.length - 1, i))].offsetLeft - items[0].offsetLeft;
  track.scrollTo({ left, behavior: reduce ? 'auto' : 'smooth' });
};
function carSync(root) {
  const track = root.querySelector('[data-car-track]'); if (!track) return;
  const i = carIndex(track), n = track.children.length;
  const canPrev = track.scrollLeft > 4, canNext = track.scrollLeft + track.clientWidth < track.scrollWidth - 4;
  const car = track.closest('.car');
  car.classList.toggle('has-prev', canPrev); car.classList.toggle('has-next', canNext);
  const ui = car.querySelector('.car-ui'); if (ui) ui.hidden = !canPrev && !canNext;       // si caben todas, no hace falta nada
  root.querySelectorAll('[data-car-dot]').forEach((d) => { const on = Number(d.dataset.carDot) === i; d.classList.toggle('on', on); if (on) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
  const cnt = root.querySelector('[data-car-count]'); if (cnt) cnt.textContent = `${i + 1} / ${n}`;
  const prev = root.querySelector('[data-car-go="-1"]'), next = root.querySelector('[data-car-go="1"]');
  if (prev) prev.disabled = !canPrev;
  if (next) next.disabled = !canNext;
}

export function installBanner() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone && !matchMedia('(display-mode: standalone)').matches;
  if (S.installEvent) return html`<div class="install">${icon('download', 24)}<span class="grow">${t('install.text')}</span><button class="btn sm gold" data-act="install">${t('install.btn')}</button></div>`;
  if (ios) return html`<div class="install">${icon('download', 24)}<span class="grow">${t('install.ios')}</span></div>`;
  return '';
}

// si el logo o la foto no cargan (p. ej. sin conexión), se enseña el marcador en vez de una imagen rota
const brokenImg = new Set();

/** Portada: el logo y tu foto, y debajo la presentación. */
function cover(next) {
  const b = CONFIG.brand, logo = b.logo && !brokenImg.has('logo'), photo = b.photo && !brokenImg.has('photo');
  return html`<section class="cover">
    <div class="cover-logo">
      ${logo ? html`<img src="${b.logo}" alt="" data-brand="logo">` : icon('glass', 38, 1.3)}
      <h1 class="${logo ? 'sr-only' : ''}">${b.name}</h1>
    </div>
    <div class="arch"><div class="frame">${photo ? html`<img src="${b.photo}" alt="${b.owner || b.name}" data-brand="photo">` : html`<div class="ph">${portraitPlaceholder()}${b.photo ? '' : html`<span>${t('home.photoPh')}</span>`}</div>`}</div></div>
    ${b.owner ? html`<p class="owner">${b.owner}</p>` : ''}
    <p class="intro">${b.intro || t('home.intro')}</p>
    ${next ? html`<a class="next-card" href="#/cata/${next.id}">
      <div class="date"><b>${dayNum(next.startsAt)}</b><span>${monthShort(next.startsAt)}</span></div>
      <div class="grow"><span class="next-label">${t('home.next')}${countdown(next.startsAt, next.durationMin) ? ' · ' + countdown(next.startsAt, next.durationMin) : ''}</span><h3>${next.title}</h3>
        <div class="meta"><span>${icon('clock', 15)}${fmtTime(next.startsAt)}</span><span>${icon('pin', 15)}${next.address || '—'}</span></div>
        <div class="small muted next-seats">${isFull(next) ? t('cata.full') + ' · ' + t('cata.waitlist') : t('cata.left', { n: seatsLeft(next) })}</div></div>
      <span class="btn primary sm">${t('home.nextSee')}</span></a>` : ''}
    <div class="cover-cta"><button class="btn ${next ? '' : 'primary'}" data-act="to-calendar">${next ? t('home.seeAll') : t('home.book')} ${icon('down', 18)}</button></div>
  </section>`;
}

const keyOf = (ms) => isoDay(ms);

export default function view({ el }) {
  let catas = null, news = null, month = null, selDay = '', carKey = '', live = null, trust = null, reviews = [], gallery = [];
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

  // aviso «Ara en directe»: solo se repinta su hueco, para no rehacer toda la portada con cada pregunta de la partida
  const liveBanner = () => (live ? html`<a class="live-banner" href="#/join/${live.code}"><span class="live-dot" aria-hidden="true"></span><span class="grow"><b>${t('home.live')}</b><span class="live-title">${live.title}</span></span><span class="btn sm">${t('home.liveJoin')}</span></a>` : '');
  const pickLive = (l) => l.filter((s) => s.announce === true && s.status !== 'ended' && Date.now() - (s.createdAt || 0) < 12 * 3600000).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] || null;

  // sección de confianza: valoración media, opiniones destacadas y fotos (se repinta sola, sin rehacer la portada)
  const trustBlock = () => {
    const showAvg = trust && trust.count >= CONFIG.trust.minRatings && trust.avg > 0;
    if (!showAvg && !reviews.length && !gallery.length) return '';
    const avg = showAvg ? trust.avg.toLocaleString(lang(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '';
    return html`<section class="sect trust"><h2>${t('home.trustTitle')}</h2>
      ${showAvg ? html`<div class="rate-sum"><b class="rate-num">${avg}</b><span><span class="stars-rate" style="--p:${Math.round((trust.avg / 5) * 100)}%" role="img" aria-label="${avg} / 5">★★★★★</span><span class="muted small rate-n">${t('home.trustN', { n: trust.count })}</span></span></div>` : ''}
      ${reviews.length ? html`<div class="rev-strip">${reviews.map((r) => html`<figure class="rev"><div class="rev-stars" role="img" aria-label="${r.stars} / 5">${'★'.repeat(r.stars)}<span>${'★'.repeat(5 - r.stars)}</span></div><blockquote>${r.comment}</blockquote><figcaption>${r.nick || ''}${r.title ? html` <span class="muted">· ${r.title}</span>` : ''}</figcaption></figure>`)}</div>` : ''}
      ${gallery.length ? html`<div class="gal">${gallery.map((g) => html`<button type="button" class="gal-i" data-gal="${g.id}" aria-label="${g.caption || '📷'}"><img src="${g.image}" alt="${g.caption || ''}" loading="lazy" decoding="async"></button>`)}</div>` : ''}
    </section>`;
  };
  const paintTrust = () => { const slot = el.querySelector('#trustSlot'); if (slot) setHtml(slot, trustBlock()); };

  const render = () => {
    const list = upcoming();
    if (catas && !month) { const f = list[0] ? new Date(list[0].startsAt) : new Date(); month = { y: f.getFullYear(), m: f.getMonth() }; }
    const shown = selDay ? list.filter((c) => keyOf(c.startsAt) === selDay) : list;
    const selDate = selDay ? fromIsoDay(selDay) : 0;
    // el carrusel se vuelve a dibujar con cada cambio de datos: guardamos por dónde iba para no devolverlo al principio
    const oldTrack = el.querySelector('[data-car-track]');
    const keepLeft = oldTrack && carKey === selDay + '|' + (month ? month.y + '-' + month.m : '') ? oldTrack.scrollLeft : 0;
    carKey = selDay + '|' + (month ? month.y + '-' + month.m : '');
    setHtml(el, html`
      <div id="liveSlot">${liveBanner()}</div>
      ${cover(catas && list[0] && !isPast(list[0]) ? list[0] : null)}
      <section class="sect" id="calendario">
        <h2>${t('home.upcoming')}</h2>
        ${month ? calendar(list) : skeleton('calendar')}
        ${selDay ? html`<div class="list-head"><h3>${t('cal.day', { d: fmtDate(selDate, { weekday: 'long', day: 'numeric', month: 'long' }) })}</h3><span class="filter">${t('cal.all')}<button type="button" data-act="clear-day" aria-label="${t('cal.all')}">×</button></span></div>` : html`<div class="mt2"></div>`}
        ${catas === null ? skeleton('cards') : shown.length ? carousel(shown) : html`<div class="card empty">${t('home.none')}</div>`}
      </section>
      <div id="trustSlot">${trustBlock()}</div>
      ${news ? html`<section class="sect"><div class="news">${icon('megaphone', 22)}<div><h3>${news.title}</h3><p class="muted small" style="margin:0">${news.body}</p></div></div></section>` : ''}
      <section class="sect"><div class="private-cta"><h3>${t('home.privateTitle')}</h3><p>${t('home.privateText')}</p><div class="cta-row"><a class="btn primary" href="#/private">${t('home.private')}</a></div><div class="cta-contact">${contactBlock()}</div></div></section>
      <div class="sect">${installBanner()}</div>
    `);
    el.querySelectorAll('img[data-brand]').forEach((img) => img.addEventListener('error', () => { brokenImg.add(img.dataset.brand); render(); }, { once: true }));
    const track = el.querySelector('[data-car-track]');
    if (track) {
      if (keepLeft) track.scrollLeft = keepLeft;
      carSync(el);
      let raf = 0;
      track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => carSync(el)); }, { passive: true });
    }
  };

  const u1 = db.onList('catas', { where: [['published', '==', true]] }, (r) => { catas = r; render(); });
  const u4 = db.onList('sessions', { where: [['announce', '==', true]] }, (l) => { const n = pickLive(l); if (n?.id === live?.id && n?.title === live?.title) return; live = n; const slot = el.querySelector('#liveSlot'); if (slot) setHtml(slot, liveBanner()); });
  const u5 = db.onDoc('settings/trust', (d) => { trust = d; paintTrust(); });
  const u6 = db.onList('reviews', { orderBy: [['featuredAt', 'desc']], limit: 6 }, (l) => { reviews = l; paintTrust(); });
  const u7 = db.onList('gallery', { orderBy: [['createdAt', 'desc']], limit: 8 }, (l) => { gallery = l; paintTrust(); });
  const u2 = db.onList('announcements', { orderBy: [['createdAt', 'desc']], limit: 1 }, (r) => { news = r[0] || null; render(); });
  const u3 = bus.on('install', render);
  const click = async (e) => {
    const tgt = e.target;
    if (tgt.closest('[data-act="install"]') && S.installEvent) { S.installEvent.prompt(); await S.installEvent.userChoice.catch(() => {}); S.installEvent = null; render(); return; }
    if (tgt.closest('[data-act="to-calendar"]')) { const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; el.querySelector('#calendario')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); return; }
    const go = tgt.closest('[data-car-go]'), dot = tgt.closest('[data-car-dot]');
    if (go || dot) {
      const track = el.querySelector('[data-car-track]'); if (!track) return;
      carScrollTo(track, dot ? Number(dot.dataset.carDot) : carIndex(track) + Number(go.dataset.carGo));
      return;
    }
    const gi = tgt.closest('[data-gal]');
    if (gi) { const g = gallery.find((x) => x.id === gi.dataset.gal); if (g) modal(html`<img class="lightbox" src="${g.image}" alt="${g.caption || ''}">${g.caption ? html`<p class="center muted mt">${g.caption}</p>` : ''}<button class="btn block mt" data-close>${t('common.back')}</button>`); return; }
    const mb = tgt.closest('[data-month]');
    if (mb && month) { const d = new Date(month.y, month.m + Number(mb.dataset.month), 1); month = { y: d.getFullYear(), m: d.getMonth() }; selDay = ''; render(); return; }
    const db_ = tgt.closest('[data-day]');
    if (db_) { selDay = selDay === db_.dataset.day ? '' : db_.dataset.day; render(); return; }
    if (tgt.closest('[data-act="clear-day"]')) { selDay = ''; render(); }
  };
  el.addEventListener('click', click);
  render();
  return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); el.removeEventListener('click', click); };
}
