/* Ranking acumulado entre catas */
import { db } from '../store.js';
import { S, loggedIn } from '../state.js';
import { t } from '../i18n.js';
import { html, setHtml, num } from '../util.js';
import { titleIndex, BADGES } from '../api.js';

export default function view({ el }) {
  let rows = null;
  const render = () => {
    const me = S.user?.uid;
    setHtml(el, html`<h1>${t('ranking.title')}</h1><p class="muted">${t('ranking.intro')}</p>
      ${rows === null ? html`<div class="empty">…</div>` : rows.length ? html`<ol class="lb">${rows.map((r, i) => html`<li class="${r.uid === me ? 'me' : ''}" style="animation-delay:${Math.min(i, 12) * 40}ms"><span class="pos">${i + 1}</span><span class="nm">${r.nick}<br><span class="small muted">${t('title.' + titleIndex(r.points || 0))} · ${t('ranking.games', { n: r.games || 0 })}</span></span><span class="small">${(r.badges || []).slice(0, 4).map((b) => BADGES.find((x) => x.id === b)?.icon || '').join(' ')}</span><span class="sc">${num(r.points || 0)}</span></li>`)}</ol>` : html`<div class="card empty"><span class="big">🍇</span>${t('ranking.empty')}</div>`}
      ${loggedIn() ? '' : html`<div class="card center mt"><p>${t('ranking.login')}</p><a class="btn primary" href="#/login?next=%2Franking">${t('auth.loginOrSignup')}</a></div>`}`);
  };
  const u = db.onList('leaderboard', { orderBy: [['points', 'desc']], limit: 50 }, (r) => { rows = r; render(); });
  render();
  return () => u();
}
