/* Ficha de una cata + reserva / lista de espera / cancelación */
import { db, auth } from '../store.js';
import { S, loggedIn } from '../state.js';
import { t } from '../i18n.js';
import { CONFIG } from '../config.js';
import { html, setHtml, fmtDateTime, fmtDate, fmtTime, money, on, formData, toast, confirmBox, confetti, skeleton } from '../util.js';
import { countdown } from '../countdown.js';
import { icon } from '../icons.js';
import { contactBlock } from '../contact.js';
import { bookSeats, cancelBooking, seatsLeft, isFull, isPast, canCancel, cancelDeadline } from '../api.js';

export const mapBlock = (c) => {
  if (c.lat == null || c.lon == null) return c.address ? html`<a class="btn sm" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}">${icon('route', 16)}${t('cata.route')}</a>` : '';
  const b = [c.lon - 0.012, c.lat - 0.007, c.lon + 0.012, c.lat + 0.007].join(',');
  return html`<iframe class="map" loading="lazy" title="map" src="https://www.openstreetmap.org/export/embed.html?bbox=${b}&layer=mapnik&marker=${c.lat},${c.lon}"></iframe>
    <div class="row wrap mt"><a class="btn sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lon}">${icon('route', 16)}${t('cata.route')}</a></div>`;
};

export default function view({ el, params }) {
  const id = params.id;
  let c = null, mine = null, seats = 2, err = '', busy = false, loaded = false, justBooked = false, freshUntil = 0;
  const render = () => {
    if (!loaded) { setHtml(el, skeleton('detail')); return; }
    if (!c || c.published === false) { setHtml(el, html`<div class="card empty">${t('cata.gone')}<div class="mt"><a class="btn" href="#/">${t('common.home')}</a></div></div>`); return; }
    const past = isPast(c), left = seatsLeft(c), full = isFull(c);
    const active = mine && mine.status !== 'cancelled';
    // reserva recién hecha: la tarjeta aparece con animación (y confeti si queda confirmada)
    let burst = false;
    if (active && justBooked) { justBooked = false; freshUntil = Date.now() + 1800; burst = mine.status === 'confirmed'; }
    seats = Math.max(1, Math.min(seats, 8));
    const p = S.profile || {};
    setHtml(el, html`
      <a href="#/" class="muted small">← ${t('common.back')}</a>
      <div class="card mt ${c.image ? 'has-hero' : ''}">
        ${c.image ? html`<img class="cata-hero" src="${c.image}" alt="">` : ''}
        <h1>${c.title}</h1>
        ${countdown(c.startsAt, c.durationMin) ? html`<span class="cd">${countdown(c.startsAt, c.durationMin)}</span>` : ''}
        <div class="meta mb"><span>${icon('calendar', 15)}${fmtDate(c.startsAt)}</span><span>${icon('clock', 15)}${fmtTime(c.startsAt)} · ${t('cata.duration', { n: c.durationMin || 120 })}</span><span>${icon('euro', 15)}${money(c.price)} <span class="muted">(${t('cata.payhere')})</span></span></div>
        ${c.showTheme && c.theme ? html`<p><b class="gold">${t('cata.theme')}:</b> ${c.theme}</p>` : html`<p class="muted"><i>${t('cata.themeHidden')}</i></p>`}
        ${c.showTheme && c.wines ? html`<p class="muted"><b>${t('cata.wines')}:</b> ${c.wines}</p>` : ''}
        ${c.notes ? html`<p class="muted">${c.notes}</p>` : ''}
        <div class="seatbar"><i style="width:${c.capacity ? Math.min(100, ((c.seatsTaken || 0) / c.capacity) * 100) : 0}%"></i></div>
        <div class="row between small mt" style="margin-top:6px"><span class="muted">${full ? t('cata.full') : t('cata.left', { n: left })}</span>${c.waitCount ? html`<span class="pill">${t('cata.inwait', { n: c.waitCount })}</span>` : ''}</div>
      </div>
      <div class="card mt"><h3 class="row" style="gap:8px">${icon('pin', 20)}<span>${c.address || ''}</span></h3>${mapBlock(c)}</div>
      <div id="bookTarget">${past ? html`<div class="card mt empty">${t('cata.past')}</div>` : active ? bookedCard() : formCard(p, full)}</div>
      ${!past && !active ? html`<div class="sticky-book" id="stickyBook">
        <div class="grow"><b>${money(c.price)}</b><span class="muted small">${full ? t('cata.full') : t('cata.left', { n: left })}</span></div>
        <button type="button" class="btn primary" data-act="to-form">${full ? t('book.joinWaitBtn') : t('book.btn')}</button></div>` : ''}
    `);
    watchForm();
    if (active && Date.now() < freshUntil) el.querySelector('#bookTarget')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    if (burst) confetti(80);
  };
  // la barra fija se esconde cuando ya se ve el formulario de reserva
  let io = null;
  function watchForm() {
    io && io.disconnect(); io = null;
    const bar = el.querySelector('#stickyBook'), tgt = el.querySelector('#bookTarget');
    if (!bar || !tgt || !('IntersectionObserver' in window)) return;
    io = new IntersectionObserver(([en]) => bar.classList.toggle('hide', en.isIntersecting && en.intersectionRatio > 0.25), { threshold: [0, 0.25, 0.5] });
    io.observe(tgt);
  }
  const bookedCard = () => {
    const ok = mine.status === 'confirmed';
    const cancellable = canCancel(c);
    const fresh = Date.now() < freshUntil;
    const tick = fresh && ok ? html`<svg class="tick" viewBox="0 0 52 52" aria-hidden="true"><circle class="tick-c" cx="26" cy="26" r="23"/><path class="tick-p" d="M15 27.5l8 8 14.5-16"/></svg>` : icon(ok ? 'check' : 'hourglass', 22);
    return html`<div class="card mt gold-edge ${fresh ? 'fresh' : ''}">
      <div class="row between"><h3 class="row" style="gap:8px">${tick}<span>${ok ? t('book.confirmed') : t('book.waiting')}</span></h3><span class="pill ${ok ? 'ok' : 'warn'}">${t('book.seats', { n: mine.seats })}</span></div>
      <p class="muted">${ok ? t('book.okText') : t('book.waitText')}</p>
      <hr class="divider">
      ${cancellable ? html`<p class="small muted">${t('book.cancelUntil', { d: fmtDateTime(cancelDeadline(c)) })}</p><button class="btn danger block" data-act="cancel" ${busy ? 'disabled' : ''}>${t('book.cancel')}</button>`
        : html`<p class="small muted">${t('book.tooLate', { n: c.cancelHours ?? CONFIG.cancelHours })}</p>${contactBlock()}`}
    </div>`;
  };
  const formCard = (p, full) => {
    if (!loggedIn()) return html`<div class="card mt center"><p>${t('book.loginFirst')}</p><a class="btn primary" href="#/login?next=${encodeURIComponent('/cata/' + id)}">${t('auth.loginOrSignup')}</a></div>`;
    return html`<form class="card mt" id="bookForm">
      <h3>${full ? t('book.joinWait') : t('book.title')}</h3>
      ${full ? html`<div class="note mb">${t('book.fullNote')}</div>` : ''}
      ${err ? html`<div class="err">${err}</div>` : ''}
      <div class="field"><span>${t('book.howMany')}</span><div class="stepper"><button type="button" data-act="minus">−</button><b>${seats}</b><button type="button" data-act="plus">+</button></div></div>
      <label class="field"><span>${t('f.name')}</span><input name="name" required value="${p.name || ''}"></label>
      <label class="field"><span>${t('f.phone')}</span><input name="phone" type="tel" required value="${p.phone || ''}"></label>
      <label class="field"><span>${t('f.allergies')}</span><input name="allergies" value="${p.allergies || ''}" placeholder="${t('f.allergiesPh')}"></label>
      <label class="check"><input type="checkbox" name="adult" required ${p.adult ? 'checked' : ''}><span>${t('age.confirm', { n: CONFIG.minAge })}</span></label>
      <p class="hint">${t('age.local')}</p>
      <button class="btn primary block" type="submit" ${busy ? 'disabled' : ''}>${full ? t('book.joinWaitBtn') : t('book.btn')}</button>
    </form>`;
  };

  const u1 = db.onDoc(`catas/${id}`, (d) => { c = d; loaded = true; render(); });
  let u2 = () => {};
  if (loggedIn()) u2 = db.onDoc(`catas/${id}/bookings/${S.user.uid}`, (b) => { mine = b; render(); });
  const off = [
    on(el, 'click', '[data-act="to-form"]', () => {
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.querySelector('#bookTarget')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }),
    on(el, 'click', '[data-act="plus"]', () => { if (seats < 8) { seats++; keepForm(); } }),
    on(el, 'click', '[data-act="minus"]', () => { if (seats > 1) { seats--; keepForm(); } }),
    on(el, 'click', '[data-act="cancel"]', async () => {
      if (!(await confirmBox(t('book.cancel'), t('book.cancelAsk'), t('book.cancelYes'), t('common.no'), true))) return;
      busy = true; render();
      try { await cancelBooking(id, S.user.uid); toast(t('book.cancelled')); } catch (e) { console.error(e); toast(t('err.generic'), 'err'); }
      busy = false; render();
    }),
    on(el, 'submit', '#bookForm', async (e) => {
      e.preventDefault(); const f = formData(e.target); err = ''; busy = true;
      try {
        if (!f.adult) throw new Error('adult');
        if (!S.profile?.adult) await db.update(`users/${S.user.uid}`, { adult: true });
        const st = await bookSeats({ ...c, id }, S.user, { seats, name: f.name, phone: f.phone, allergies: f.allergies });
        justBooked = true; toast(st === 'confirmed' ? t('book.done') : t('book.doneWait'));
      } catch (ex) { console.error(ex); err = ex.message === 'already' ? t('book.already') : ex.message === 'gone' ? t('cata.gone') : t('err.generic'); }
      busy = false; render();
    }),
  ];
  // mantiene lo escrito en el formulario al cambiar el número de plazas
  function keepForm() {
    const f = el.querySelector('#bookForm'); const keep = f ? { ...formData(f) } : null; render();
    const nf = el.querySelector('#bookForm'); if (nf && keep) for (const k of ['name', 'phone', 'allergies']) if (nf.elements[k]) nf.elements[k].value = keep[k] ?? '';
  }
  render();
  return () => { u1(); u2(); io && io.disconnect(); off.forEach((f) => f()); };
}
