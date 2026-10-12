/* Panel: banco de preguntas (a mano o generadas desde el catálogo de vinos) */
import { db } from '../../store.js';
import { html, setHtml, on, formData, toast, modal, confirmBox, resizeImage, geocode } from '../../util.js';
import { t } from '../../i18n.js';
import { adminTabs } from './ui.js';
import { allCats, questionFor } from '../../quiz.js';
import { CONFIG } from '../../config.js';
import { LETTERS } from '../../ui-game.js';

const BLANK = () => ({ prompt: '', options: ['', '', '', ''], correct: 0, category: '', wineId: '', ref: '', durationSec: CONFIG.game.defaultSeconds, points: CONFIG.game.basePoints, explanation: '', image: '', mapQuery: '', lat: null, lon: null });

export default function view({ el, query }) {
  let qs = null, wines = [], extra = [], filter = '', text = '';
  const cats = () => allCats(extra);
  const catLabel = (k) => cats().find((c) => c.key === k)?.label || '';

  const render = () => {
    const list = (qs || []).filter((q) => (!filter || q.category === filter) && (!text || (q.prompt + ' ' + q.ref).toLowerCase().includes(text.toLowerCase()))).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    setHtml(el, html`${adminTabs('/admin/questions')}
      <div class="row between mb wrap"><h1 style="margin:0">${t('a.tab.questions')}</h1><div class="row"><button class="btn" data-act="bulk">✨ ${t('a.q.fromWine')}</button><button class="btn primary" data-act="new">＋ ${t('a.q.new')}</button></div></div>
      <div class="grid c2 mb"><input id="qsearch" placeholder="${t('a.search')}" value="${text}"><select id="qfilter"><option value="">${t('a.q.allCats')}</option>${cats().map((c) => html`<option value="${c.key}" ${filter === c.key ? 'selected' : ''}>${c.label}</option>`)}</select></div>
      ${qs === null ? html`<div class="empty">…</div>` : list.length ? html`<div class="grid auto">${list.map((q) => html`<div class="card"><div class="row wrap mb">${q.ref ? html`<span class="tag">${q.ref}</span>` : ''}${q.category ? html`<span class="tag">${catLabel(q.category)}</span>` : ''}<span class="tag">⏱ ${q.durationSec}s</span><span class="tag">⭐ ${q.points}</span>${q.image ? html`<span class="tag">🖼</span>` : ''}${q.lat != null ? html`<span class="tag">🗺</span>` : ''}</div>
        <h3>${q.prompt}</h3><ol type="A" style="margin:0 0 10px;padding-left:22px" class="small">${q.options.map((o, i) => html`<li class="${i === q.correct ? 'ok' : 'muted'}">${o}${i === q.correct ? ' ✓' : ''}</li>`)}</ol>
        <div class="row wrap"><button class="btn sm" data-edit="${q.id}">${t('a.edit')}</button><button class="btn sm" data-dup="${q.id}">${t('a.dup')}</button><button class="btn sm danger" data-del="${q.id}">${t('a.del')}</button></div></div>`)}</div>` : html`<div class="card empty"><span class="big">❓</span>${t('a.q.none')}</div>`}`);
  };

  // ---------- editor ----------
  function editor(q0) {
    const q = { ...BLANK(), ...q0, options: [...(q0?.options || BLANK().options)] };
    const m = modal(html``);
    const sync = () => {
      const f = m.el.querySelector('#qForm'); if (!f) return;
      const d = formData(f);
      q.prompt = d.prompt; q.ref = d.ref; q.category = d.category; q.wineId = d.wineId; q.durationSec = d.durationSec || 20; q.points = d.points || 100; q.explanation = d.explanation; q.mapQuery = d.mapQuery;
      q.options = q.options.map((_, i) => d['opt' + i] ?? '');
      if (d.correct != null) q.correct = Number(d.correct);
    };
    const draw = () => {
      m.el.innerHTML = html`<h3>${q0?.id ? t('a.q.editTitle') : t('a.q.newTitle')}</h3>
        <div class="card mb" style="padding:10px"><div class="small muted mb">${t('a.q.autofill')}</div><div class="grid c2"><select id="gWine"><option value="">${t('a.q.winePh')}</option>${wines.map((w) => html`<option value="${w.id}">${w.name}</option>`)}</select><select id="gCat">${cats().map((c) => html`<option value="${c.key}">${c.label}</option>`)}</select></div><button type="button" class="btn sm mt" data-act="gen">✨ ${t('a.q.gen')}</button></div>
        <form id="qForm">
          <label class="field"><span>${t('a.q.question')}</span><input name="prompt" required value="${q.prompt}"></label>
          <div class="grid c2"><label class="field"><span>${t('a.q.ref')}</span><input name="ref" value="${q.ref}"></label>
            <label class="field"><span>${t('a.q.category')}</span><select name="category"><option value="">—</option>${cats().map((c) => html`<option value="${c.key}" ${q.category === c.key ? 'selected' : ''}>${c.label}</option>`)}</select></label></div>
          <input type="hidden" name="wineId" value="${q.wineId}">
          <div class="field"><span>${t('a.q.options')}</span>${q.options.map((o, i) => html`<div class="row mb"><input type="radio" name="correct" value="${i}" ${q.correct === i ? 'checked' : ''} title="${t('a.q.correct')}"><b style="width:20px">${LETTERS[i]}</b><input name="opt${i}" value="${o}" ${i < 2 ? 'required' : ''} placeholder="${t('a.q.optPh', { l: LETTERS[i] })}">${q.options.length > 2 ? html`<button type="button" class="btn sm ghost" data-rmopt="${i}">✕</button>` : ''}</div>`)}
            ${q.options.length < 6 ? html`<button type="button" class="btn sm" data-act="addopt">＋ ${t('a.q.addOpt')}</button>` : ''}</div>
          <div class="grid c2"><label class="field"><span>${t('a.q.time')}</span><input type="number" name="durationSec" min="5" max="180" value="${q.durationSec}"></label>
            <label class="field"><span>${t('a.q.points')}</span><input type="number" name="points" min="10" step="10" value="${q.points}"></label></div>
          <label class="field"><span>${t('a.q.explanation')}</span><input name="explanation" value="${q.explanation}"></label>
          <div class="field"><span>${t('a.q.image')}</span>${q.image ? html`<img class="img-q mb" src="${q.image}" alt=""><button type="button" class="btn sm danger" data-act="rmimg">${t('a.q.rmImg')}</button>` : html`<input type="file" accept="image/*" id="qImg">`}</div>
          <div class="field"><span>${t('a.q.map')}</span><div class="row"><input name="mapQuery" placeholder="${t('a.q.mapPh')}" value="${q.mapQuery}"><button type="button" class="btn sm" data-act="geo">${t('a.q.find')}</button></div>
            <div class="small ${q.lat != null ? 'ok' : 'muted'} mt" style="margin-top:6px">${q.lat != null ? t('a.q.mapAdded') + ' ' : t('a.q.noMap')} ${q.lat != null ? html`<a href="#" data-act="rmmap">${t('a.remove').toLowerCase()}</a>` : ''}</div></div>
          <button class="btn primary block">${t('common.save')}</button></form>`.s;
    };
    draw();
    m.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act],[data-rmopt]'); if (!b) return;
      if (b.dataset.act === 'addopt') { sync(); q.options.push(''); draw(); }
      else if (b.dataset.rmopt != null) { sync(); const i = Number(b.dataset.rmopt); q.options.splice(i, 1); if (q.correct >= q.options.length) q.correct = 0; else if (q.correct > i) q.correct--; draw(); }
      else if (b.dataset.act === 'rmimg') { sync(); q.image = ''; draw(); }
      else if (b.dataset.act === 'rmmap') { e.preventDefault(); sync(); q.lat = q.lon = null; q.mapQuery = ''; draw(); }
      else if (b.dataset.act === 'geo') { sync(); if (!q.mapQuery) return; b.textContent = '…'; const g = await geocode(q.mapQuery); if (g) { q.lat = g.lat; q.lon = g.lon; } else toast(t('a.q.placeMiss'), 'err'); draw(); }
      else if (b.dataset.act === 'gen') {
        const w = wines.find((x) => x.id === m.el.querySelector('#gWine').value), key = m.el.querySelector('#gCat').value;
        if (!w) { toast(t('a.q.pickWine'), 'err'); return; }
        const g = questionFor(w, key, wines, cats()); if (!g) { toast(t('a.q.noData'), 'err'); return; }
        sync(); Object.assign(q, { prompt: g.prompt, options: g.options, correct: g.correct, category: key, wineId: w.id }); draw();
      }
    });
    m.el.addEventListener('change', async (e) => {
      if (e.target.id === 'qImg' && e.target.files[0]) { sync(); try { q.image = await resizeImage(e.target.files[0]); } catch { toast(t('a.q.imgErr'), 'err'); } draw(); }
    });
    m.el.addEventListener('submit', async (e) => {
      e.preventDefault(); sync();
      if (q.options.filter((o) => o.trim()).length < 2) { toast(t('a.q.min2'), 'err'); return; }
      const { id, ...data } = q;
      try { if (q0?.id) await db.update(`questions/${q0.id}`, data); else await db.add('questions', { ...data, createdAt: db.ts() }); m.close(); toast(t('a.q.saved')); } catch (ex) { console.error(ex); toast(t('a.q.saveErr'), 'err'); }
    });
  }

  // ---------- varias preguntas desde un vino ----------
  function bulk(wineId) {
    const m = modal(html`<h3>${t('a.q.bulkTitle')}</h3>
      <label class="field"><span>${t('a.q.wine')}</span><select id="bWine"><option value="">${t('a.q.pickWineOpt')}</option>${wines.map((w) => html`<option value="${w.id}" ${w.id === wineId ? 'selected' : ''}>${w.name}</option>`)}</select></label>
      <div id="bCats"></div><label class="field"><span>${t('a.q.screenRef')}</span><input id="bRef"></label><button class="btn primary block" id="bGo" disabled>${t('a.q.create')}</button>`);
    const draw = () => {
      const w = wines.find((x) => x.id === m.el.querySelector('#bWine').value);
      m.el.querySelector('#bCats').innerHTML = w ? html`${cats().filter((c) => w.attrs?.[c.key]).map((c) => html`<label class="check"><input type="checkbox" value="${c.key}" checked><span>${c.label}: <b>${w.attrs[c.key]}</b></span></label>`)}`.s : '';
      m.el.querySelector('#bGo').disabled = !w;
    };
    m.el.querySelector('#bWine').addEventListener('change', draw); draw();
    m.el.querySelector('#bGo').addEventListener('click', async () => {
      const w = wines.find((x) => x.id === m.el.querySelector('#bWine').value); const ref = m.el.querySelector('#bRef').value.trim();
      const keys = [...m.el.querySelectorAll('#bCats input:checked')].map((i) => i.value);
      const ops = keys.map((k, i) => { const q = questionFor(w, k, wines, cats()); if (!q) return null; q.ref = ref; return ['set', `questions/gen_${Date.now().toString(36)}_${i}`, { ...q, createdAt: Date.now() + i }]; }).filter(Boolean);
      if (!ops.length) { toast(t('a.q.pickCat'), 'err'); return; }
      await db.batch(ops); m.close(); toast(t('a.q.madeN', { n: ops.length }));
    });
  }

  const subs = [
    db.onList('questions', {}, (l) => { qs = l; render(); }),
    db.onList('wines', {}, (l) => { wines = l.sort((a, b) => a.name.localeCompare(b.name)); render(); }),
    db.onDoc('settings/categories', (d) => { extra = d?.extra || []; render(); }),
  ];
  const offs = [
    on(el, 'click', '[data-act="new"]', () => editor(null)),
    on(el, 'click', '[data-act="bulk"]', () => bulk(query.wine || '')),
    on(el, 'click', '[data-edit]', (e, b) => editor(qs.find((q) => q.id === b.dataset.edit))),
    on(el, 'click', '[data-dup]', async (e, b) => { const { id, ...q } = qs.find((x) => x.id === b.dataset.dup); await db.add('questions', { ...q, prompt: q.prompt + ' ' + t('a.q.copy'), createdAt: db.ts() }); toast(t('a.q.duplicated')); }),
    on(el, 'click', '[data-del]', async (e, b) => { if (await confirmBox(t('a.q.delTitle'), t('a.q.delAsk'), t('a.del'), t('common.back'), true)) { await db.del(`questions/${b.dataset.del}`); toast(t('a.q.deleted')); } }),
    on(el, 'input', '#qsearch', (e, i) => { text = i.value; const pos = i.selectionStart; render(); const n = el.querySelector('#qsearch'); n.focus(); n.setSelectionRange(pos, pos); }),
    on(el, 'change', '#qfilter', (e, s) => { filter = s.value; render(); }),
  ];
  render();
  if (query.wine) setTimeout(() => bulk(query.wine), 150);
  return () => { subs.forEach((f) => f()); offs.forEach((f) => f()); };
}
