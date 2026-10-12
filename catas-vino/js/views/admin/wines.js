/* Panel: catálogo de vinos y categorías de datos (se pueden añadir las que quieras) */
import { db } from '../../store.js';
import { html, setHtml, on, formData, toast, modal, confirmBox, slug } from '../../util.js';
import { adminTabs } from './ui.js';
import { CORE_CATS, allCats } from '../../quiz.js';

export default function view({ el }) {
  let wines = null, extra = [];
  const cats = () => allCats(extra);
  const render = () => {
    setHtml(el, html`${adminTabs('/admin/wines')}
      <div class="row between mb"><h1 style="margin:0">Catálogo de vinos</h1><button class="btn primary" data-act="new">＋ Nuevo vino</button></div>
      <div class="card mb"><h3>Datos que guardas de cada vino</h3><p class="muted small">Con estos datos se generan las preguntas. Puedes añadir las categorías que quieras.</p>
        <div class="row wrap">${CORE_CATS.map((c) => html`<span class="pill">${c.label}</span>`)}${extra.map((c) => html`<span class="pill gold">${c.label} <a href="#" data-delcat="${c.key}" style="text-decoration:none" title="Quitar">✕</a></span>`)}</div>
        <form class="row mt" id="catForm"><input name="label" placeholder="Nueva categoría (ej.: Maridaje, Color, Enólogo…)" required><button class="btn">Añadir</button></form></div>
      ${wines === null ? html`<div class="empty">…</div>` : wines.length ? html`<div class="grid auto">${[...wines].sort((a, b) => a.name.localeCompare(b.name)).map((w) => html`<div class="card"><h3>${w.name}</h3>
        <div class="mb">${cats().filter((c) => w.attrs?.[c.key]).map((c) => html`<div class="small"><span class="muted">${c.label}:</span> ${w.attrs[c.key]}${c.key === 'abv' ? ' %' : ''}</div>`)}</div>
        <div class="row wrap"><button class="btn sm" data-edit="${w.id}">Editar</button><a class="btn sm gold" href="#/admin/questions?wine=${w.id}">Crear preguntas</a><button class="btn sm danger" data-del="${w.id}">Eliminar</button></div></div>`)}</div>` : html`<div class="card empty"><span class="big">🍇</span>Todavía no hay vinos. Añade el primero.</div>`}`);
  };
  const edit = (w) => {
    const a = w?.attrs || {};
    const m = modal(html`<h3>${w ? 'Editar vino' : 'Nuevo vino'}</h3><form id="wForm">
      <label class="field"><span>Nombre del vino</span><input name="name" required value="${w?.name || ''}"></label>
      ${cats().map((c) => html`<label class="field"><span>${c.label}</span><input name="a_${c.key}" value="${a[c.key] || ''}" ${c.key === 'abv' ? html`inputmode="decimal" placeholder="14,5"` : ''}></label>`)}
      <label class="field"><span>Notas (solo para ti)</span><textarea name="notes">${w?.notes || ''}</textarea></label>
      <button class="btn primary block">Guardar</button></form>`);
    m.el.querySelector('#wForm').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = formData(e.target); const attrs = {};
      cats().forEach((c) => { const v = f['a_' + c.key]; if (v) attrs[c.key] = v; });
      try { if (w) await db.update(`wines/${w.id}`, { name: f.name, attrs, notes: f.notes }); else await db.add('wines', { name: f.name, attrs, notes: f.notes, createdAt: db.ts() }); m.close(); toast('Vino guardado'); } catch (ex) { console.error(ex); toast('No se pudo guardar', 'err'); }
    });
  };
  const subs = [db.onList('wines', {}, (l) => { wines = l; render(); }), db.onDoc('settings/categories', (d) => { extra = d?.extra || []; render(); })];
  const offs = [
    on(el, 'click', '[data-act="new"]', () => edit(null)),
    on(el, 'click', '[data-edit]', (e, b) => edit(wines.find((w) => w.id === b.dataset.edit))),
    on(el, 'click', '[data-del]', async (e, b) => { const w = wines.find((x) => x.id === b.dataset.del); if (await confirmBox('Eliminar vino', `¿Eliminar «${w.name}» del catálogo? Las preguntas ya creadas no se borran.`, 'Eliminar', 'Volver', true)) { await db.del(`wines/${w.id}`); toast('Vino eliminado'); } }),
    on(el, 'submit', '#catForm', async (e) => {
      e.preventDefault(); const label = formData(e.target).label; let key = slug(label);
      if ([...CORE_CATS, ...extra].some((c) => c.key === key)) key += '-2';
      await db.set('settings/categories', { extra: [...extra, { key, label }] }); toast('Categoría añadida');
    }),
    on(el, 'click', '[data-delcat]', async (e, b) => { e.preventDefault(); const c = extra.find((x) => x.key === b.dataset.delcat); if (await confirmBox('Quitar categoría', `¿Quitar «${c.label}»? Los datos ya guardados en los vinos se conservan.`, 'Quitar', 'Volver', true)) await db.set('settings/categories', { extra: extra.filter((x) => x.key !== c.key) }); }),
  ];
  render();
  return () => { subs.forEach((f) => f()); offs.forEach((f) => f()); };
}
