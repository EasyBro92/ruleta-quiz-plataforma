/* Panel: confianza de la portada (valoración media, opiniones destacadas y galería de fotos) */
import { db } from '../../store.js';
import { html, setHtml, on, formData, toast, confirmBox, resizeImage, skeleton } from '../../util.js';
import { t } from '../../i18n.js';
import { CONFIG } from '../../config.js';
import { adminTabs } from './ui.js';
import { updateTrustStats } from '../../api.js';

export default function view({ el }) {
  let trust = null, reviews = null, gallery = null, cands = null, busy = false;
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

  const render = () => {
    const featured = new Set((reviews || []).map((r) => r.srcKey).filter(Boolean));
    const open = (cands || []).filter((c) => !featured.has(c.key));
    setHtml(el, html`${adminTabs('/admin/trust')}<h1>${t('a.tab.trust')}</h1>
      <div class="card"><div class="row between"><div><h3 style="margin:0">${t('a.t.stats')}</h3>
        <div class="bignum" style="font-size:2rem">${trust && trust.count ? trust.avg.toFixed(1).replace('.', ',') + ' ★' : '—'}</div>
        <div class="muted small">${trust ? t('a.t.statsN', { n: trust.count }) : '…'}</div></div>
        <button class="btn sm" data-act="recalc" ${busy ? 'disabled' : ''}>${t('a.t.recalc')}</button></div>
        <p class="hint" style="margin-bottom:0">${t('a.t.minNote', { n: CONFIG.trust.minRatings })}</p></div>

      <h2 class="mt2">${t('a.t.reviews')}</h2><p class="muted small" style="margin-top:0">${t('a.t.revHint')}</p>
      ${reviews === null ? skeleton('rows') : reviews.length ? html`<div class="stack">${reviews.map((r) => html`<div class="card"><div class="row between top"><div class="grow"><div class="gold">${stars(r.stars)}</div><p style="margin:4px 0">${r.comment}</p><div class="small muted">${r.nick || ''}${r.title ? ' · ' + r.title : ''}${r.sample ? ' · ' + t('a.t.sample') : ''}</div></div><button class="btn sm danger" data-rmrev="${r.id}">${t('a.t.remove')}</button></div></div>`)}</div>` : html`<div class="card empty">${t('a.t.none')}</div>`}

      <form class="card mt" id="revForm"><h3>${t('a.t.addOwn')}</h3>
        <div class="grid c2"><label class="field"><span>${t('a.t.name')}</span><input name="nick" required maxlength="40"></label>
          <label class="field"><span>${t('a.t.stars')}</span><select name="stars">${[5, 4, 3].map((n) => html`<option value="${n}">${stars(n)}</option>`)}</select></label></div>
        <label class="field"><span>${t('a.t.text')}</span><textarea name="comment" rows="3" required maxlength="300"></textarea></label>
        <button class="btn primary">${t('a.t.add')}</button></form>

      <h3 class="mt2">${t('a.t.fromGames')}</h3>
      ${cands === null ? skeleton('rows') : open.length ? html`<div class="stack">${open.map((c) => html`<div class="card"><div class="row between top"><div class="grow"><div class="gold">${stars(c.stars)}</div><p style="margin:4px 0">${c.comment}</p><div class="small muted">${c.nick || ''} · ${c.title}</div></div><button class="btn sm" data-feat="${c.key}">${t('a.t.feature')}</button></div></div>`)}</div>` : html`<div class="card empty">${t('a.t.none')}</div>`}

      <h2 class="mt2">${t('a.t.gallery')}</h2><p class="muted small" style="margin-top:0">${t('a.t.galHint')}</p>
      <div class="card"><label class="btn" for="galIn">${t('a.t.upload')}</label><input type="file" id="galIn" accept="image/*" multiple hidden></div>
      ${gallery === null ? '' : gallery.length ? html`<div class="gal mt">${gallery.map((g) => html`<div class="gal-i"><img src="${g.image}" alt="" loading="lazy"><button type="button" class="gal-x" data-rmgal="${g.id}" aria-label="${t('a.t.remove')}">×</button></div>`)}</div>` : ''}`);
  };

  // opiniones escritas por los participantes en las últimas partidas
  async function loadCands() {
    const out = [];
    try {
      const sessions = await db.list('sessions', { orderBy: [['createdAt', 'desc']], limit: 30 });
      for (const s of sessions) {
        const rs = (await db.list(`sessions/${s.id}/ratings`)).filter((r) => r.comment && r.stars >= 1);
        for (const r of rs) { const p = await db.get(`sessions/${s.id}/players/${r.id}`).catch(() => null); out.push({ key: `${s.id}_${r.id}`, stars: r.stars, comment: r.comment, nick: p?.nick || '', title: s.title }); }
      }
    } catch (e) { console.error(e); }
    cands = out; render();
  }
  const recalc = async () => { busy = true; render(); try { trust = await updateTrustStats(); } catch (e) { console.error(e); toast(t('err.generic'), 'err'); } busy = false; render(); };

  const subs = [
    db.onDoc('settings/trust', (d) => { trust = d; render(); }),
    db.onList('reviews', { orderBy: [['featuredAt', 'desc']], limit: 50 }, (l) => { reviews = l; render(); }),
    db.onList('gallery', { orderBy: [['createdAt', 'desc']], limit: 30 }, (l) => { gallery = l; render(); }),
  ];
  const offs = [
    on(el, 'click', '[data-act="recalc"]', recalc),
    on(el, 'click', '[data-feat]', async (e, b) => {
      const c = cands.find((x) => x.key === b.dataset.feat); if (!c) return;
      await db.add('reviews', { stars: c.stars, comment: c.comment, nick: c.nick, title: c.title, srcKey: c.key, featuredAt: db.ts() }); toast(t('a.t.done'));
    }),
    on(el, 'click', '[data-rmrev]', async (e, b) => { if (await confirmBox(t('a.t.remove'), t('a.t.removeAsk'), t('a.t.remove'), t('common.back'), true)) { await db.del(`reviews/${b.dataset.rmrev}`); toast(t('a.t.done')); } }),
    on(el, 'submit', '#revForm', async (e) => {
      e.preventDefault(); const f = formData(e.target);
      await db.add('reviews', { stars: Number(f.stars) || 5, comment: f.comment, nick: f.nick, title: '', featuredAt: db.ts() }); e.target.reset(); toast(t('a.t.done'));
    }),
    on(el, 'click', '[data-rmgal]', async (e, b) => { if (await confirmBox(t('a.t.remove'), t('a.t.removeAsk'), t('a.t.remove'), t('common.back'), true)) { await db.del(`gallery/${b.dataset.rmgal}`); toast(t('a.t.done')); } }),
    on(el, 'change', '#galIn', async (e, inp) => {
      const files = [...inp.files].slice(0, 10);
      for (const f of files) { try { await db.add('gallery', { image: await resizeImage(f, 900, 0.72), caption: '', createdAt: db.ts() }); } catch (ex) { console.error(ex); toast(t('err.generic'), 'err'); } }
      if (files.length) toast(t('a.t.done'));
    }),
  ];
  render(); loadCands(); recalc();
  return () => { subs.forEach((f) => f()); offs.forEach((f) => f()); };
}
