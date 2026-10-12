/* Panel: premios, canjes, sorteos y novedades */
import { db } from '../../store.js';
import { html, setHtml, on, formData, toast, modal, confirmBox, fmtShortDate } from '../../util.js';
import { adminTabs } from './ui.js';
import { REWARD_ICON, sendNotice } from '../../api.js';

const TYPES = { discount: 'Descuento', free: 'Copa o cata gratis', raffle: 'Sorteo (cada canje = una papeleta)' };
const RED_ES = { active: 'Por usar', used: 'Usado', void: 'Anulado', entered: 'En sorteo', won: 'Ganador' };

export default function view({ el }) {
  let rewards = null, reds = [], news = [], q = '';
  const edit = (r) => {
    const m = modal(html`<h3>${r ? 'Editar premio' : 'Nuevo premio'}</h3><form id="rForm">
      <label class="field"><span>Título</span><input name="title" required value="${r?.title || ''}"></label>
      <label class="field"><span>Descripción</span><textarea name="desc">${r?.desc || ''}</textarea></label>
      <div class="grid c2"><label class="field"><span>Tipo</span><select name="type">${Object.entries(TYPES).map(([k, v]) => html`<option value="${k}" ${r?.type === k ? 'selected' : ''}>${v}</option>`)}</select></label>
        <label class="field"><span>Coste en puntos</span><input type="number" name="cost" min="1" required value="${r?.cost || 300}"></label></div>
      <label class="check"><input type="checkbox" name="active" ${r?.active !== false ? 'checked' : ''}><span>Visible para los clientes</span></label>
      <button class="btn primary block">Guardar</button></form>`);
    m.el.querySelector('#rForm').addEventListener('submit', async (e) => { e.preventDefault(); const f = formData(e.target); try { if (r) await db.update(`rewards/${r.id}`, f); else await db.add('rewards', { ...f, createdAt: db.ts() }); m.close(); toast('Premio guardado'); } catch (ex) { console.error(ex); toast('No se pudo guardar', 'err'); } });
  };
  const render = () => {
    const found = q ? reds.filter((r) => r.code === q.toUpperCase().trim()) : [];
    const raffles = (rewards || []).filter((r) => r.type === 'raffle');
    setHtml(el, html`${adminTabs('/admin/rewards')}
      <div class="row between mb"><h1 style="margin:0">Premios</h1><button class="btn primary" data-act="new">＋ Nuevo premio</button></div>
      ${rewards === null ? html`<div class="empty">…</div>` : rewards.length ? html`<div class="grid auto">${rewards.map((r) => html`<div class="card"><div class="row top"><span style="font-size:1.8rem">${REWARD_ICON[r.type] || '🎁'}</span><div class="grow"><h3 style="margin:0">${r.title}</h3><p class="muted small" style="margin:2px 0">${r.desc || ''}</p><span class="pill gold">${r.cost} puntos</span> ${r.active === false ? html`<span class="pill">Oculto</span>` : ''}</div></div>
        <div class="row wrap mt"><button class="btn sm" data-edit="${r.id}">Editar</button>${r.type === 'raffle' ? html`<button class="btn sm gold" data-draw="${r.id}">🎟️ Sortear (${reds.filter((x) => x.rewardId === r.id && x.status === 'entered').length})</button>` : ''}<button class="btn sm danger" data-del="${r.id}">Eliminar</button></div></div>`)}</div>` : html`<div class="card empty">Aún no hay premios.</div>`}
      <h2 class="mt2">Canjes</h2>
      <div class="card mb"><label class="field" style="margin:0"><span>Comprobar un código</span><input id="codeQ" placeholder="Código del cliente" value="${q}" style="text-transform:uppercase"></label>
        ${q ? (found.length ? found.map((r) => html`<div class="row between mt"><div><b>${r.title}</b><div class="small muted">${r.nick} · ${RED_ES[r.status]}</div></div>${r.status === 'active' ? html`<button class="btn sm primary" data-used="${r.id}">Marcar usado</button>` : ''}</div>`) : html`<p class="muted mt" style="margin-bottom:0">No existe ese código.</p>`) : ''}</div>
      ${reds.length ? html`<div class="scroll-x card"><table><thead><tr><th>Cliente</th><th>Premio</th><th>Código</th><th>Estado</th><th></th></tr></thead><tbody>${reds.map((r) => html`<tr><td>${r.nick}</td><td>${r.title}</td><td><b>${r.code}</b></td><td><span class="pill ${r.status === 'active' ? 'ok' : r.status === 'won' ? 'gold' : ''}">${RED_ES[r.status]}</span></td><td class="right nowrap">${r.status === 'active' ? html`<button class="btn sm" data-used="${r.id}">Usado</button> <button class="btn sm danger" data-void="${r.id}">Anular</button>` : ''}</td></tr>`)}</tbody></table></div>` : html`<div class="card empty">Todavía no hay canjes.</div>`}
      <h2 class="mt2">Novedades</h2>
      <form class="card" id="nForm"><label class="field"><span>Título</span><input name="title" required></label><label class="field"><span>Mensaje</span><textarea name="body" required></textarea></label><button class="btn primary">Publicar novedad</button></form>
      <div class="stack mt">${news.map((n) => html`<div class="card row between top"><div><b>${n.title}</b><p class="muted small" style="margin:2px 0">${n.body}</p><div class="small muted">${n.createdAt ? fmtShortDate(n.createdAt) : ''}</div></div><button class="btn sm danger" data-delnews="${n.id}">✕</button></div>`)}</div>`);
  };
  const subs = [
    db.onList('rewards', {}, (l) => { rewards = l.sort((a, b) => a.cost - b.cost); render(); }),
    db.onList('redemptions', { orderBy: [['createdAt', 'desc']], limit: 80 }, (l) => { reds = l; if (!el.contains(document.activeElement) || document.activeElement.id !== 'codeQ') render(); }),
    db.onList('announcements', { orderBy: [['createdAt', 'desc']], limit: 10 }, (l) => { news = l; render(); }),
  ];
  const offs = [
    on(el, 'click', '[data-act="new"]', () => edit(null)),
    on(el, 'click', '[data-edit]', (e, b) => edit(rewards.find((r) => r.id === b.dataset.edit))),
    on(el, 'click', '[data-del]', async (e, b) => { if (await confirmBox('Eliminar premio', '¿Eliminar este premio?', 'Eliminar', 'Volver', true)) await db.del(`rewards/${b.dataset.del}`); }),
    on(el, 'click', '[data-used]', async (e, b) => { await db.update(`redemptions/${b.dataset.used}`, { status: 'used' }); toast('Marcado como usado'); }),
    on(el, 'click', '[data-void]', async (e, b) => { if (await confirmBox('Anular canje', 'Se devolverán los puntos al cliente.', 'Anular', 'Volver', true)) { await db.update(`redemptions/${b.dataset.void}`, { status: 'void' }); toast('Canje anulado'); } }),
    on(el, 'input', '#codeQ', (e, i) => { q = i.value; render(); const n = el.querySelector('#codeQ'); n.focus(); n.setSelectionRange(q.length, q.length); }),
    on(el, 'click', '[data-draw]', async (e, b) => {
      const r = rewards.find((x) => x.id === b.dataset.draw); const pool = reds.filter((x) => x.rewardId === r.id && x.status === 'entered');
      if (!pool.length) { toast('Nadie participa todavía', 'err'); return; }
      if (!(await confirmBox('Sortear', `${pool.length} papeleta(s) para «${r.title}».`, 'Sortear ahora', 'Volver'))) return;
      const w = pool[Math.floor(Math.random() * pool.length)];
      await db.batch([['update', `redemptions/${w.id}`, { status: 'won' }], ...pool.filter((x) => x.id !== w.id).map((x) => ['update', `redemptions/${x.id}`, { status: 'used' }])]);
      await sendNotice(w.uid, 'raffle_won', { title: r.title }, '/me');
      modal(html`<div class="center"><div style="font-size:3rem">🎉</div><h2>¡Ganador!</h2><div class="bignum">${w.nick}</div><p class="muted">${r.title}</p><button class="btn block mt" data-close>OK</button></div>`);
    }),
    on(el, 'submit', '#nForm', async (e) => { e.preventDefault(); const f = formData(e.target); await db.add('announcements', { title: f.title, body: f.body, createdAt: db.ts() }); e.target.reset(); toast('Novedad publicada'); }),
    on(el, 'click', '[data-delnews]', async (e, b) => { await db.del(`announcements/${b.dataset.delnews}`); }),
  ];
  render();
  return () => { subs.forEach((f) => f()); offs.forEach((f) => f()); };
}
