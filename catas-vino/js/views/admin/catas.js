/* Panel: listado de catas */
import { db } from '../../store.js';
import { html, setHtml, on, fmtDateTime, money } from '../../util.js';
import { t } from '../../i18n.js';
import { adminTabs } from './ui.js';
import { isPast } from '../../api.js';

export default function view({ el }) {
  let catas = null, show = 'next';
  const render = () => {
    const list = (catas || []).filter((c) => (show === 'next' ? !isPast(c) : isPast(c))).sort((a, b) => (show === 'next' ? a.startsAt - b.startsAt : b.startsAt - a.startsAt));
    setHtml(el, html`${adminTabs('/admin')}
      <div class="row between mb"><h1 style="margin:0">${t('a.catas.title')}</h1><a class="btn primary" href="#/admin/cata/new">＋ ${t('a.catas.new')}</a></div>
      <div class="seg mb" style="max-width:340px"><button data-show="next" class="${show === 'next' ? 'on' : ''}">${t('a.catas.next')}</button><button data-show="past" class="${show === 'past' ? 'on' : ''}">${t('a.catas.past')}</button></div>
      ${catas === null ? html`<div class="empty">…</div>` : list.length ? html`<div class="grid auto">${list.map((c) => html`<div class="card"><div class="row between top"><h3>${c.title}</h3>${c.published === false ? html`<span class="pill">${t('a.catas.draft')}</span>` : ''}</div>
        <div class="meta mb"><span>📅 ${fmtDateTime(c.startsAt)}</span><span>📍 ${c.address || '—'}</span><span>💶 ${money(c.price)}</span></div>
        <div class="row wrap"><span class="pill ok">👥 ${c.seatsTaken || 0}/${c.capacity}</span>${c.waitCount ? html`<span class="pill warn">⏳ ${t('a.catas.waitN', { n: c.waitCount })}</span>` : ''}</div>
        <div class="row wrap mt"><a class="btn sm primary" href="#/admin/cata/${c.id}">${t('a.catas.edit')}</a><a class="btn sm" href="#/admin/games?cata=${c.id}">🎲 ${t('a.makeGame')}</a></div></div>`)}</div>`
        : html`<div class="card empty"><span class="big">🍇</span>${show === 'next' ? t('a.catas.noNext') : t('a.catas.noPast')}</div>`}`);
  };
  const u = db.onList('catas', {}, (l) => { catas = l; render(); });
  const off = on(el, 'click', '[data-show]', (e, b) => { show = b.dataset.show; render(); });
  render();
  return () => { u(); off(); };
}
