/* Solicitud de cata privada: elige una fecha libre y envía el formulario */
import { db } from '../store.js';
import { S, go, loggedIn } from '../state.js';
import { t } from '../i18n.js';
import { CONFIG } from '../config.js';
import { html, setHtml, fmtDate, fromIsoDay, isoDay, on, formData, toast } from '../util.js';
import { createPrivateRequest } from '../api.js';
import { icon } from '../icons.js';

export default function view({ el }) {
  if (!loggedIn()) { setHtml(el, html`<div class="card center"><span class="big-ic">${icon('glass', 34, 1.3)}</span><h2>${t('home.private')}</h2><p class="muted">${t('private.intro')}</p><a class="btn primary" href="#/login?next=%2Fprivate">${t('auth.loginOrSignup')}</a></div>`); return; }
  let dates = null, busy = false, err = '';
  const render = () => {
    const today = isoDay(Date.now());
    const list = (dates || []).filter((d) => d >= today).sort().slice(0, 36);
    const p = S.profile || {};
    setHtml(el, html`<a href="#/" class="muted small">← ${t('common.back')}</a>
      <h1 class="mt">${t('home.private')}</h1><p class="muted">${t('private.intro')}</p>
      <form class="card" id="pForm">
        ${err ? html`<div class="err">${err}</div>` : ''}
        <div class="field"><span>${t('private.date')}</span>
          ${dates === null ? html`<div class="muted">…</div>` : list.length ? html`<div class="chips">${list.map((d) => { const ms = fromIsoDay(d); return html`<label><input type="radio" name="date" value="${d}" required><span>${fmtDate(ms, { weekday: 'short' })}<b>${new Date(ms).getDate()}</b>${fmtDate(ms, { month: 'short' })}</span></label>`; })}</div>` : html`<div class="note">${t('private.nodates')}</div>`}
        </div>
        <div class="grid c2">
          <label class="field"><span>${t('private.time')}</span><input type="time" name="time" required value="20:00"></label>
          <label class="field"><span>${t('private.people')}</span><input type="number" name="people" required min="2" max="80" value="8"></label>
        </div>
        <label class="field"><span>${t('private.place')}</span><input name="place" required placeholder="${t('private.placePh')}"></label>
        <label class="field"><span>${t('private.notes')}</span><textarea name="notes" placeholder="${t('private.notesPh')}"></textarea></label>
        <div class="grid c2">
          <label class="field"><span>${t('f.name')}</span><input name="name" required value="${p.name || ''}"></label>
          <label class="field"><span>${t('f.phone')}</span><input name="phone" type="tel" required value="${p.phone || ''}"></label>
        </div>
        <label class="check"><input type="checkbox" name="adult" required ${p.adult ? 'checked' : ''}><span>${t('age.confirmGroup', { n: CONFIG.minAge })}</span></label>
        <button class="btn primary block" type="submit" ${busy || (dates && !list.length) ? 'disabled' : ''}>${t('private.send')}</button>
        <p class="hint mt">${t('private.after')}</p>
      </form>`);
  };
  const u = db.onDoc('settings/availability', (d) => { dates = d?.dates || []; if (!el.querySelector('input[name=date]:checked')) render(); });
  const off = on(el, 'submit', '#pForm', async (e) => {
    e.preventDefault(); const f = formData(e.target); if (!f.date) { err = t('private.pickDate'); render(); return; }
    busy = true; err = '';
    try { await createPrivateRequest(S.user, f); toast(t('private.sent')); go('/mine'); } catch (ex) { console.error(ex); err = t('err.generic'); busy = false; render(); }
  });
  render();
  return () => { u(); off(); };
}
