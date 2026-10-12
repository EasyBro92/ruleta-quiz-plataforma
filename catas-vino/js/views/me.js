/* Perfil: puntos, título, insignias, premios y datos personales */
import { db, auth } from '../store.js';
import { S, go, loggedIn, isStaff } from '../state.js';
import { t } from '../i18n.js';
import { html, setHtml, on, formData, toast, modal, confirmBox, rid, num, fmtShortDate } from '../util.js';
import { titleIndex, nextStep, TITLE_STEPS, BADGES, REWARD_ICON, spendable } from '../api.js';
import { installBanner } from './catas.js';
import { icon } from '../icons.js';

export default function view({ el }) {
  if (!loggedIn()) { setHtml(el, html`<div class="card center"><span class="big-ic">${icon('user', 34, 1.3)}</span><h2>${t('me.guest')}</h2><p class="muted">${t('me.guestText')}</p><a class="btn primary" href="#/login">${t('auth.loginOrSignup')}</a></div><div class="mt">${installBanner()}</div>`); return; }
  const uid = S.user.uid;
  let lb = null, rewards = [], reds = [], results = [], saved = false;
  const render = () => {
    const p = S.profile || {}; const pts = lb?.points || 0, ti = titleIndex(pts), nx = nextStep(pts);
    const prev = TITLE_STEPS[ti], pct = nx ? Math.round(((pts - prev) / (nx - prev)) * 100) : 100;
    const sp = spendable(lb, reds);
    const have = new Set(lb?.badges || []);
    setHtml(el, html`
      <div class="card gold-edge center"><div class="muted small">${p.name || ''}</div><h1 style="margin:0">${p.nick || ''}</h1><div class="pill gold mt">${t('title.' + ti)}</div>
        <div class="bignum mt">${num(sp)}</div><div class="muted small">${t('me.available')} · ${t('me.total', { n: num(pts) })}</div>
        <div class="progress mt"><i style="width:${pct}%"></i></div><div class="small muted mt" style="margin-top:6px">${nx ? t('me.nextTitle', { n: num(nx - pts), title: t('title.' + (ti + 1)) }) : t('me.maxTitle')}</div>
        <div class="row wrap mt" style="justify-content:center"><span class="pill">${icon('dice', 14)}${t('ranking.games', { n: lb?.games || 0 })}</span><span class="pill">🥇 ${lb?.wins || 0}</span></div></div>
      <h2 class="mt2">${t('me.badges')}</h2>
      <div class="grid c3">${BADGES.map((b) => html`<div class="card center" style="padding:12px 6px"><div class="badge-ic ${have.has(b.id) ? '' : 'off'}" style="margin:0 auto 6px">${b.icon}</div><div class="small"><b>${t('badge.' + b.id)}</b></div><div class="small muted">${t('badge.' + b.id + '.d')}</div></div>`)}</div>
      <h2 class="mt2">${t('me.rewards')}</h2>
      <div class="stack">${rewards.length ? rewards.map((r) => html`<div class="card"><div class="row top"><span style="font-size:1.8rem">${REWARD_ICON[r.type] || '🎁'}</span><div class="grow"><h3 style="margin:0">${r.title}</h3><p class="muted small" style="margin:2px 0 0">${r.desc || ''}</p></div><div class="center"><div class="gold"><b>${num(r.cost)}</b></div><button class="btn sm gold mt" data-redeem="${r.id}" ${sp < r.cost ? 'disabled' : ''}>${r.type === 'raffle' ? t('me.enter') : t('me.redeem')}</button></div></div></div>`) : html`<div class="muted small">${t('me.noRewards')}</div>`}</div>
      ${reds.length ? html`<h3 class="mt2">${t('me.myRedemptions')}</h3><div class="stack">${[...reds].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map((r) => html`<div class="card row between"><div><b>${r.title}</b><div class="small muted">${r.createdAt ? fmtShortDate(r.createdAt) : ''}</div></div><div class="center"><span class="code" style="font-size:1.4rem;letter-spacing:.1em">${r.code}</span><div><span class="pill ${r.status === 'used' || r.status === 'void' ? '' : r.status === 'won' ? 'gold' : 'ok'}">${t('red.' + r.status)}</span></div></div></div>`)}</div>` : ''}
      ${results.length ? html`<h2 class="mt2">${t('me.history')}</h2><div class="stack">${results.map((r) => html`<div class="card row between"><div><b>${r.title}</b><div class="small muted">${fmtShortDate(r.date)} · ✓ ${r.correct}/${r.total}</div></div><div class="center"><div class="gold"><b>#${r.rank}</b><span class="muted small">/${r.players}</span></div><div class="small">+${r.pointsGained ?? r.score}</div></div></div>`)}</div>` : ''}
      <h2 class="mt2">${t('me.data')}</h2>
      <form class="card" id="profForm">
        <label class="field"><span>${t('f.name')}</span><input name="name" required value="${p.name || ''}"></label>
        <label class="field"><span>${t('f.nick')}</span><input name="nick" required maxlength="18" value="${p.nick || ''}"></label>
        <label class="field"><span>${t('f.email')}</span><input value="${S.user.email || ''}" disabled></label>
        <label class="field"><span>${t('f.phone')}</span><input name="phone" type="tel" value="${p.phone || ''}"></label>
        <label class="field"><span>${t('f.allergies')}</span><input name="allergies" value="${p.allergies || ''}" placeholder="${t('f.allergiesPh')}"></label>
        <button class="btn primary block">${saved ? '✓ ' + t('common.saved') : t('common.save')}</button></form>
      <div class="mt">${installBanner()}</div>
      <div class="row wrap mt">${isStaff() ? html`<a class="btn" href="#/admin">${icon('sliders', 16)}${t('nav.admin')}</a>` : ''}<button class="btn ghost" data-act="logout">${t('auth.logout')}</button></div>`);
  };
  const subs = [
    db.onDoc('leaderboard/' + uid, (d) => { lb = d; render(); }),
    db.onList('rewards', { where: [['active', '==', true]] }, (l) => { rewards = l.sort((a, b) => a.cost - b.cost); render(); }),
    db.onList('redemptions', { where: [['uid', '==', uid]] }, (l) => { reds = l; render(); }),
    db.onList('results', { where: [['uid', '==', uid]], orderBy: [['date', 'desc']], limit: 8 }, (l) => { results = l; render(); }),
  ];
  const offs = [
    on(el, 'submit', '#profForm', async (e) => { e.preventDefault(); const f = formData(e.target); try { await db.update('users/' + uid, { name: f.name, nick: f.nick, phone: f.phone, allergies: f.allergies }); saved = true; toast(t('common.saved')); render(); } catch { toast(t('err.generic'), 'err'); } }),
    on(el, 'click', '[data-act="logout"]', async () => { await auth.signOut(); go('/'); }),
    on(el, 'click', '[data-redeem]', async (e, b) => {
      const r = rewards.find((x) => x.id === b.dataset.redeem); if (!r) return;
      if (!(await confirmBox(r.title, t('me.redeemAsk', { n: num(r.cost) }), t('common.confirm'), t('common.cancel')))) return;
      if (spendable(lb, reds) < r.cost) { toast(t('me.noPoints'), 'err'); return; }
      const code = rid(6).toUpperCase();
      try {
        await db.add('redemptions', { uid, nick: S.profile?.nick || '', rewardId: r.id, title: r.title, type: r.type, cost: r.cost, code, status: r.type === 'raffle' ? 'entered' : 'active', createdAt: db.ts() });
        modal(html`<div class="center"><div style="font-size:2.4rem">🎉</div><h2>${r.title}</h2><p class="muted">${r.type === 'raffle' ? t('me.raffleDone') : t('me.showCode')}</p><div class="code">${code}</div><button class="btn block mt" data-close>OK</button></div>`);
      } catch (ex) { console.error(ex); toast(t('err.generic'), 'err'); }
    }),
  ];
  render();
  return () => { subs.forEach((f) => f()); offs.forEach((f) => f()); };
}
