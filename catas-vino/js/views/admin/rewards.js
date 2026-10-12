/* Panel: premios, canjes, sorteos y novedades */
import { db } from '../../store.js';
import { html, setHtml, on, formData, toast, modal, confirmBox, fmtShortDate } from '../../util.js';
import { t } from '../../i18n.js';
import { adminTabs } from './ui.js';
import { REWARD_ICON, sendNotice } from '../../api.js';

const TYPES = ['discount', 'free', 'raffle'];
const redLabel = (s) => t('red.' + s);

export default function view({ el }) {
  let rewards = null, reds = [], news = [], q = '';
  const edit = (r) => {
    const m = modal(html`<h3>${r ? t('a.r.editTitle') : t('a.r.new')}</h3><form id="rForm">
      <label class="field"><span>${t('a.cata.f.title')}</span><input name="title" required value="${r?.title || ''}"></label>
      <label class="field"><span>${t('a.r.desc')}</span><textarea name="desc">${r?.desc || ''}</textarea></label>
      <div class="grid c2"><label class="field"><span>${t('a.r.type')}</span><select name="type">${TYPES.map((k) => html`<option value="${k}" ${r?.type === k ? 'selected' : ''}>${t('a.r.type.' + k)}</option>`)}</select></label>
        <label class="field"><span>${t('a.r.cost')}</span><input type="number" name="cost" min="1" required value="${r?.cost || 300}"></label></div>
      <label class="check"><input type="checkbox" name="active" ${r?.active !== false ? 'checked' : ''}><span>${t('a.r.visible')}</span></label>
      <button class="btn primary block">${t('common.save')}</button></form>`);
    m.el.querySelector('#rForm').addEventListener('submit', async (e) => { e.preventDefault(); const f = formData(e.target); try { if (r) await db.update(`rewards/${r.id}`, f); else await db.add('rewards', { ...f, createdAt: db.ts() }); m.close(); toast(t('a.r.saved')); } catch (ex) { console.error(ex); toast(t('a.saveErr'), 'err'); } });
  };
  const render = () => {
    const found = q ? reds.filter((r) => r.code === q.toUpperCase().trim()) : [];
    const raffles = (rewards || []).filter((r) => r.type === 'raffle');
    setHtml(el, html`${adminTabs('/admin/rewards')}
      <div class="row between mb"><h1 style="margin:0">${t('a.tab.rewards')}</h1><button class="btn primary" data-act="new">＋ ${t('a.r.new')}</button></div>
      ${rewards === null ? html`<div class="empty">…</div>` : rewards.length ? html`<div class="grid auto">${rewards.map((r) => html`<div class="card"><div class="row top"><span style="font-size:1.8rem">${REWARD_ICON[r.type] || '🎁'}</span><div class="grow"><h3 style="margin:0">${r.title}</h3><p class="muted small" style="margin:2px 0">${r.desc || ''}</p><span class="pill gold">${t('a.r.points', { n: r.cost })}</span> ${r.active === false ? html`<span class="pill">${t('a.r.hidden')}</span>` : ''}</div></div>
        <div class="row wrap mt"><button class="btn sm" data-edit="${r.id}">${t('a.edit')}</button>${r.type === 'raffle' ? html`<button class="btn sm gold" data-draw="${r.id}">🎟️ ${t('a.r.draw')} (${reds.filter((x) => x.rewardId === r.id && x.status === 'entered').length})</button>` : ''}<button class="btn sm danger" data-del="${r.id}">${t('a.del')}</button></div></div>`)}</div>` : html`<div class="card empty">${t('a.r.none')}</div>`}
      <h2 class="mt2">${t('a.r.redemptions')}</h2>
      <div class="card mb"><label class="field" style="margin:0"><span>${t('a.r.checkCode')}</span><input id="codeQ" placeholder="${t('a.r.codePh')}" value="${q}" style="text-transform:uppercase"></label>
        ${q ? (found.length ? found.map((r) => html`<div class="row between mt"><div><b>${r.title}</b><div class="small muted">${r.nick} · ${redLabel(r.status)}</div></div>${r.status === 'active' ? html`<button class="btn sm primary" data-used="${r.id}">${t('a.r.markUsed')}</button>` : ''}</div>`) : html`<p class="muted mt" style="margin-bottom:0">${t('a.r.noCode')}</p>`) : ''}</div>
      ${reds.length ? html`<div class="scroll-x card"><table><thead><tr><th>${t('a.cata.th.client')}</th><th>${t('a.r.th.prize')}</th><th>${t('a.r.th.code')}</th><th>${t('a.cata.th.status')}</th><th></th></tr></thead><tbody>${reds.map((r) => html`<tr><td>${r.nick}</td><td>${r.title}</td><td><b>${r.code}</b></td><td><span class="pill ${r.status === 'active' ? 'ok' : r.status === 'won' ? 'gold' : ''}">${redLabel(r.status)}</span></td><td class="right nowrap">${r.status === 'active' ? html`<button class="btn sm" data-used="${r.id}">${t('red.used')}</button> <button class="btn sm danger" data-void="${r.id}">${t('a.r.void')}</button>` : ''}</td></tr>`)}</tbody></table></div>` : html`<div class="card empty">${t('a.r.noRed')}</div>`}
      <h2 class="mt2">${t('a.r.news')}</h2>
      <form class="card" id="nForm"><label class="field"><span>${t('a.cata.f.title')}</span><input name="title" required></label><label class="field"><span>${t('a.r.msg')}</span><textarea name="body" required></textarea></label><button class="btn primary">${t('a.r.publish')}</button></form>
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
    on(el, 'click', '[data-del]', async (e, b) => { if (await confirmBox(t('a.r.delTitle'), t('a.r.delAsk'), t('a.del'), t('common.back'), true)) await db.del(`rewards/${b.dataset.del}`); }),
    on(el, 'click', '[data-used]', async (e, b) => { await db.update(`redemptions/${b.dataset.used}`, { status: 'used' }); toast(t('a.r.markedUsed')); }),
    on(el, 'click', '[data-void]', async (e, b) => { if (await confirmBox(t('a.r.voidTitle'), t('a.r.voidAsk'), t('a.r.void'), t('common.back'), true)) { await db.update(`redemptions/${b.dataset.void}`, { status: 'void' }); toast(t('a.r.voided')); } }),
    on(el, 'input', '#codeQ', (e, i) => { q = i.value; render(); const n = el.querySelector('#codeQ'); n.focus(); n.setSelectionRange(q.length, q.length); }),
    on(el, 'click', '[data-draw]', async (e, b) => {
      const r = rewards.find((x) => x.id === b.dataset.draw); const pool = reds.filter((x) => x.rewardId === r.id && x.status === 'entered');
      if (!pool.length) { toast(t('a.r.nobody'), 'err'); return; }
      if (!(await confirmBox(t('a.r.draw'), t('a.r.drawAsk', { n: pool.length, title: r.title }), t('a.r.drawNow'), t('common.back')))) return;
      const w = pool[Math.floor(Math.random() * pool.length)];
      await db.batch([['update', `redemptions/${w.id}`, { status: 'won' }], ...pool.filter((x) => x.id !== w.id).map((x) => ['update', `redemptions/${x.id}`, { status: 'used' }])]);
      await sendNotice(w.uid, 'raffle_won', { title: r.title }, '/me');
      modal(html`<div class="center"><div style="font-size:3rem">🎉</div><h2>${t('red.won')}</h2><div class="bignum">${w.nick}</div><p class="muted">${r.title}</p><button class="btn block mt" data-close>${t('common.ok')}</button></div>`);
    }),
    on(el, 'submit', '#nForm', async (e) => { e.preventDefault(); const f = formData(e.target); await db.add('announcements', { title: f.title, body: f.body, createdAt: db.ts() }); e.target.reset(); toast(t('a.r.published')); }),
    on(el, 'click', '[data-delnews]', async (e, b) => { await db.del(`announcements/${b.dataset.delnews}`); }),
  ];
  render();
  return () => { subs.forEach((f) => f()); offs.forEach((f) => f()); };
}
