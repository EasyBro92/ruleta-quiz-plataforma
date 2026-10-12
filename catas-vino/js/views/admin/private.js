/* Panel: solicitudes de cata privada y calendario de fechas libres */
import { db } from '../../store.js';
import { html, setHtml, on, formData, toast, modal, fmtDate, fromIsoDay, isoDay } from '../../util.js';
import { adminTabs, STATUS_ES, pillFor } from './ui.js';
import { answerPrivateRequest } from '../../api.js';

export default function view({ el }) {
  let reqs = null, free = [], catas = [], month = new Date(); month.setDate(1);
  const busyDays = () => {
    const s = new Set(catas.filter((c) => c.published !== false).map((c) => isoDay(c.startsAt)));
    (reqs || []).filter((r) => r.status === 'accepted').forEach((r) => s.add(r.date));
    return s;
  };
  const calendar = () => {
    const y = month.getFullYear(), m = month.getMonth(), first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7, today = isoDay(Date.now()), busy = busyDays();
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(html`<button class="blank" disabled></button>`);
    for (let d = 1; d <= days; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cls = [free.includes(iso) ? 'on' : '', busy.has(iso) ? 'busy' : '', iso < today ? 'past' : ''].join(' ');
      cells.push(html`<button class="${cls}" data-day="${iso}" title="${busy.has(iso) ? 'Ya hay una cata ese día' : ''}">${d}</button>`);
    }
    return html`<div class="row between mb"><button class="btn sm" data-month="-1">‹</button><b style="text-transform:capitalize">${new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(month)}</b><button class="btn sm" data-month="1">›</button></div>
      <div class="cal">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((x) => html`<div class="h">${x}</div>`)}${cells}</div>
      <div class="row wrap small muted mt"><span class="pill ok" style="background:rgba(179,42,77,.5)">Libre para privadas</span><span class="pill gold">Ya hay cata</span></div>`;
  };
  const card = (r) => html`<div class="card"><div class="row between top"><div><h3 style="margin:0">${r.name}</h3><div class="small muted">${r.phone} · ${r.email || ''}</div></div><span class="pill ${pillFor(r.status)}">${STATUS_ES[r.status]}</span></div>
    <div class="meta mt"><span>📅 ${fmtDate(fromIsoDay(r.date), { weekday: 'long', day: 'numeric', month: 'long' })} · ${r.time}</span><span>👥 ${r.people} personas</span><span>📍 ${r.place}</span></div>
    ${r.notes ? html`<p class="muted mt" style="margin-bottom:0">“${r.notes}”</p>` : ''}
    ${r.status === 'counter' ? html`<p class="small mt gold">Propuesta: ${r.counterDate ? fmtDate(fromIsoDay(r.counterDate)) : ''} ${r.counterNote || ''}</p>` : ''}
    ${r.status === 'pending' || r.status === 'counter' ? html`<div class="row wrap mt"><button class="btn sm primary" data-answer="accepted" data-id="${r.id}">Aceptar</button><button class="btn sm" data-answer="counter" data-id="${r.id}">Proponer otra fecha</button><button class="btn sm danger" data-answer="rejected" data-id="${r.id}">Rechazar</button></div>` : ''}</div>`;
  const render = () => {
    const pend = (reqs || []).filter((r) => r.status === 'pending' || r.status === 'counter'), done = (reqs || []).filter((r) => !pend.includes(r));
    setHtml(el, html`${adminTabs('/admin/private')}<h1>Catas privadas</h1>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr));align-items:start">
        <div><h2>Solicitudes ${pend.length ? html`<span class="pill warn">${pend.length}</span>` : ''}</h2>
          ${reqs === null ? html`<div class="empty">…</div>` : pend.length ? html`<div class="stack">${pend.map(card)}</div>` : html`<div class="card empty">No hay solicitudes pendientes.</div>`}
          ${done.length ? html`<details class="mt2"><summary class="muted">Historial (${done.length})</summary><div class="stack mt">${done.map(card)}</div></details>` : ''}</div>
        <div class="card"><h2>Fechas libres</h2><p class="muted small">Toca los días en los que aceptas catas privadas. Los clientes solo verán esos días.</p>${calendar()}</div>
      </div>`);
  };
  const subs = [
    db.onList('privateRequests', { orderBy: [['createdAt', 'desc']] }, (l) => { reqs = l; render(); }),
    db.onDoc('settings/availability', (d) => { free = d?.dates || []; render(); }),
    db.onList('catas', {}, (l) => { catas = l; render(); }),
  ];
  const offs = [
    on(el, 'click', '[data-month]', (e, b) => { month = new Date(month.getFullYear(), month.getMonth() + Number(b.dataset.month), 1); render(); }),
    on(el, 'click', '[data-day]', async (e, b) => { const d = b.dataset.day; const next = free.includes(d) ? free.filter((x) => x !== d) : [...free, d].sort(); free = next; render(); await db.set('settings/availability', { dates: next }); }),
    on(el, 'click', '[data-answer]', (e, b) => {
      const r = reqs.find((x) => x.id === b.dataset.id), kind = b.dataset.answer;
      const upcoming = free.filter((d) => d >= isoDay(Date.now())).slice(0, 20);
      const m = modal(html`<h3>${kind === 'accepted' ? 'Aceptar solicitud' : kind === 'rejected' ? 'Rechazar solicitud' : 'Proponer otra fecha'}</h3>
        <form id="aForm">
          ${kind === 'counter' ? html`<label class="field"><span>Nueva fecha</span><select name="counterDate" required>${upcoming.map((d) => html`<option value="${d}">${fmtDate(fromIsoDay(d))}</option>`)}</select></label>` : ''}
          <label class="field"><span>Mensaje para el cliente (opcional)</span><textarea name="note" placeholder="${kind === 'accepted' ? 'Ej.: Te llamo mañana para cerrar detalles.' : ''}"></textarea></label>
          <button class="btn ${kind === 'rejected' ? 'danger' : 'primary'} block">Enviar respuesta</button></form>`);
      m.el.querySelector('#aForm').addEventListener('submit', async (e2) => {
        e2.preventDefault(); const f = formData(e2.target);
        try { await answerPrivateRequest(r, kind, { counterDate: f.counterDate || '', counterNote: f.note || '' }); m.close(); toast('Respuesta enviada'); } catch (ex) { console.error(ex); toast('No se pudo enviar', 'err'); }
      });
    }),
  ];
  render();
  return () => { subs.forEach((f) => f()); offs.forEach((f) => f()); };
}
