/* Panel: crear partidas y ver las anteriores */
import { db } from '../../store.js';
import { S, go } from '../../state.js';
import { html, setHtml, on, formData, toast, modal, fmtDateTime, fmtShortDate } from '../../util.js';
import { adminTabs } from './ui.js';
import { createSession } from '../../game.js';

const MODES = { off: 'Sin equipos (solo individual)', free: 'Equipos libres: los jugadores crean o eligen', assigned: 'Equipos asignados por mí', table: 'Por mesas (cada mesa tiene su código)' };

export default function view({ el, query }) {
  let qs = [], catas = [], sessions = null, picked = [], title = '', cataId = query.cata || '', mode = 'off', tables = 4, text = '', busy = false;
  const fillTitle = () => { const c = catas.find((x) => x.id === cataId); if (c && !title) title = c.title; };

  const render = () => {
    fillTitle();
    const avail = qs.filter((q) => !picked.includes(q.id) && (!text || (q.prompt + ' ' + q.ref).toLowerCase().includes(text.toLowerCase()))).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const sel = picked.map((id) => qs.find((q) => q.id === id)).filter(Boolean);
    const total = sel.reduce((a, q) => a + (q.durationSec || 20) + 12, 0);
    setHtml(el, html`${adminTabs('/admin/games')}<h1>Partidas</h1>
      <form class="card" id="gForm">
        <h2>Nueva partida</h2>
        <div class="grid c2">
          <label class="field"><span>Título</span><input name="title" required value="${title}" placeholder="Ej.: Cata de tintos · viernes"></label>
          <label class="field"><span>Cata asociada (opcional)</span><select name="cataId"><option value="">—</option>${[...catas].sort((a, b) => b.startsAt - a.startsAt).map((c) => html`<option value="${c.id}" ${c.id === cataId ? 'selected' : ''}>${c.title} · ${fmtShortDate(c.startsAt)}</option>`)}</select></label>
        </div>
        <div class="grid c2">
          <label class="field"><span>Equipos</span><select name="mode">${Object.entries(MODES).map(([k, v]) => html`<option value="${k}" ${mode === k ? 'selected' : ''}>${v}</option>`)}</select></label>
          ${mode === 'table' ? html`<label class="field"><span>Número de mesas</span><input type="number" name="tables" min="2" max="30" value="${tables}"></label>` : ''}
        </div>
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));align-items:start">
          <div><h3>Banco de preguntas</h3><input id="gsearch" placeholder="Buscar…" value="${text}" class="mb">
            <div style="max-height:340px;overflow:auto">${avail.length ? avail.map((q) => html`<div class="qrow"><div class="grow"><div class="small">${q.ref ? html`<span class="tag">${q.ref}</span>` : ''}${q.prompt}</div></div><button type="button" class="btn sm" data-add="${q.id}">＋</button></div>`) : html`<p class="muted small">${qs.length ? 'No quedan preguntas con ese filtro.' : 'Aún no hay preguntas: créalas en la pestaña Preguntas.'}</p>`}</div>
            ${avail.length > 1 ? html`<button type="button" class="btn sm mt" data-act="addall">Añadir todas</button>` : ''}</div>
          <div><h3>Orden de la partida <span class="muted small">(${sel.length} · ~${Math.round(total / 60)} min)</span></h3>
            ${sel.length ? sel.map((q, i) => html`<div class="qrow"><b class="gold">${i + 1}</b><div class="grow small">${q.ref ? html`<span class="tag">${q.ref}</span>` : ''}${q.prompt}</div><div class="row"><button type="button" class="btn sm ghost" data-up="${i}">↑</button><button type="button" class="btn sm ghost" data-down="${i}">↓</button><button type="button" class="btn sm ghost" data-rm="${i}">✕</button></div></div>`) : html`<p class="muted small">Añade preguntas desde el banco.</p>`}</div>
        </div>
        <button class="btn primary block mt" ${busy || !sel.length ? 'disabled' : ''}>Crear partida y abrir la sala</button>
      </form>
      <h2 class="mt2">Partidas anteriores</h2>
      ${sessions === null ? html`<div class="empty">…</div>` : sessions.length ? html`<div class="grid auto">${sessions.map((s) => html`<div class="card"><div class="row between"><h3 style="margin:0">${s.title}</h3><span class="pill ${s.status === 'ended' ? '' : 'gold'}">${s.status === 'ended' ? 'Terminada' : s.status === 'lobby' ? 'En sala' : 'En juego'}</span></div>
        <div class="meta mt"><span>🔑 ${s.code}</span><span>❓ ${s.total}</span><span>${s.createdAt ? fmtDateTime(s.createdAt) : ''}</span></div>
        ${s.final ? html`<p class="small muted mt" style="margin-bottom:0">🏆 ${s.final.top[0]?.nick || '—'} · 👥 ${s.final.players}</p>` : ''}
        <div class="row wrap mt"><a class="btn sm primary" href="#/admin/run/${s.id}">${s.status === 'ended' ? 'Ver resultados' : 'Presentar'}</a>${s.status === 'ended' ? html`<button class="btn sm" data-rate="${s.id}">Valoraciones</button>` : ''}</div></div>`)}</div>` : html`<div class="card empty">Todavía no hay partidas.</div>`}`);
  };
  const keepFields = () => { const f = el.querySelector('#gForm'); if (f) { const d = formData(f); title = d.title ?? title; cataId = d.cataId ?? cataId; mode = d.mode ?? mode; tables = d.tables ?? tables; } };

  const subs = [
    db.onList('questions', {}, (l) => { qs = l; render(); }),
    db.onList('catas', {}, (l) => { catas = l; render(); }),
    db.onList('sessions', { orderBy: [['createdAt', 'desc']], limit: 20 }, (l) => { sessions = l; render(); }),
  ];
  const move = (i, d) => { keepFields(); const j = i + d; if (j < 0 || j >= picked.length) return; [picked[i], picked[j]] = [picked[j], picked[i]]; render(); };
  const offs = [
    on(el, 'click', '[data-add]', (e, b) => { keepFields(); picked.push(b.dataset.add); render(); }),
    on(el, 'click', '[data-act="addall"]', () => { keepFields(); qs.filter((q) => !picked.includes(q.id) && (!text || (q.prompt + ' ' + q.ref).toLowerCase().includes(text.toLowerCase()))).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).forEach((q) => picked.push(q.id)); render(); }),
    on(el, 'click', '[data-up]', (e, b) => move(Number(b.dataset.up), -1)),
    on(el, 'click', '[data-down]', (e, b) => move(Number(b.dataset.down), 1)),
    on(el, 'click', '[data-rm]', (e, b) => { keepFields(); picked.splice(Number(b.dataset.rm), 1); render(); }),
    on(el, 'change', '[name=mode],[name=cataId]', (e, s) => { const prevCata = cataId; keepFields(); if (s.name === 'cataId' && cataId && cataId !== prevCata) { const c = catas.find((x) => x.id === cataId); if (c) title = c.title; } render(); }),
    on(el, 'input', '#gsearch', (e, i) => { keepFields(); text = i.value; const pos = i.selectionStart; render(); const n = el.querySelector('#gsearch'); n.focus(); n.setSelectionRange(pos, pos); }),
    on(el, 'submit', '#gForm', async (e) => {
      e.preventDefault(); keepFields(); busy = true; render();
      try {
        const questions = picked.map((id) => qs.find((q) => q.id === id)).filter(Boolean);
        const tb = mode === 'table' ? Array.from({ length: tables || 4 }, (_, i) => 'Mesa ' + (i + 1)) : [];
        const { sid } = await createSession({ title, cataId, questions, teamMode: mode, tables: tb, createdBy: S.user.uid });
        go('/admin/run/' + sid);
      } catch (ex) { console.error(ex); toast('No se pudo crear la partida', 'err'); busy = false; render(); }
    }),
    on(el, 'click', '[data-rate]', async (e, b) => {
      const list = await db.list(`sessions/${b.dataset.rate}/ratings`);
      const avg = list.length ? (list.reduce((a, r) => a + r.stars, 0) / list.length).toFixed(1) : '—';
      modal(html`<h3>Valoraciones</h3><div class="center"><div class="bignum">${avg} ⭐</div><div class="muted small">${list.length} valoraciones</div></div><div class="stack mt">${list.filter((r) => r.comment).map((r) => html`<div class="card"><div>${'⭐'.repeat(r.stars)}</div><p class="muted" style="margin:0">“${r.comment}”</p></div>`)}</div><button class="btn block mt" data-close>Cerrar</button>`);
    }),
  ];
  render();
  return () => { subs.forEach((f) => f()); offs.forEach((f) => f()); };
}
