/* Pantalla del participante durante la partida */
import { db, auth } from '../store.js';
import { go, loggedIn } from '../state.js';
import { t } from '../i18n.js';
import { html, setHtml, on, toast, sfx, isMuted, setMuted, confetti, formData } from '../util.js';
import { standings, teamStandings, submitAnswer, rate, fastestLabel } from '../game.js';
import { ring, updateRing, mediaBlock, optionsView, lbList, podium, shareResult } from '../ui-game.js';
import { BADGES } from '../api.js';

export default function view({ el, params }) {
  const sid = params.sid;
  if (!auth.current) { go('/play'); return; }
  const uid = auth.current.uid;
  let s = null, me = null, players = [], teams = [], myAns = null, res = null, stars = 0, rated = false, timeUp = false;
  let lastSig = '', lastIdx = -2, lastStatus = '', startLocal = 0, timer = null, unAns = () => {}, unRes = () => {}, soundedEnd = false;

  const myTeam = () => teams.find((x) => x.id === me?.teamId);
  const header = () => html`<div class="head"><div class="row wrap"><span class="pill gold">🍷 ${me?.nick || ''}</span>${myTeam() ? html`<span class="pill" style="border-color:${myTeam().color}">${myTeam().name}</span>` : ''}</div>
    <div class="row"><span class="pill">⭐ ${me?.score || 0}</span><button class="icon-btn" data-act="mute" aria-label="sound">${isMuted() ? '🔇' : '🔊'}</button></div></div>`;

  function sig() {
    const base = [s?.status, s?.qIndex, s?.cur?.open, s?.reveal?.index, me?.score, me?.lastOk, me?.teamId, myAns?.choice, timeUp, s?.teamMode, rated, stars, res?.rank];
    if (!s || s.status === 'lobby') base.push(players.length, teams.map((x) => x.id + x.name).join());
    if (s?.status === 'reveal' || s?.status === 'ended') base.push(players.map((p) => p.id + ':' + p.score).join(), teams.length);
    if (s?.status === 'question') base.push(s?.answeredCount);
    return JSON.stringify(base);
  }

  function render(force = false) {
    if (!s) { setHtml(el, html`<div class="game"><div class="empty">…</div></div>`); return; }
    const sg = sig(); if (!force && sg === lastSig) return; lastSig = sg;
    let body;
    if (s.status === 'lobby') body = lobby();
    else if (s.status === 'question') body = question();
    else if (s.status === 'reveal') body = reveal();
    else body = ended();
    setHtml(el, html`<div class="game">${header()}${body}</div>`);
    if (s.status === 'ended' && lastStatus !== 'ended') { if (res?.rank <= 3 || (rankOf() <= 3)) { confetti(120); sfx.fanfare(); } else sfx.good(); }
    lastStatus = s.status;
  }
  const rankOf = () => standings(players).findIndex((p) => p.id === uid) + 1;

  const lobby = () => html`<div class="card center" style="margin:auto 0"><div style="font-size:3rem" class="boot-glass">🍷</div><h2>${t('game.lobbyTitle', { nick: me?.nick || '' })}</h2><p class="muted">${t('game.lobbyText')}</p>
      <div class="pill">${s.title}</div><div class="mt"><span class="pill gold">👥 ${t('game.players', { n: players.length })}</span></div>
      ${s.teamMode === 'free' && teams.length ? html`<label class="field mt"><span>${t('join.team')}</span><select data-act="team"><option value="">${t('join.noTeam')}</option>${teams.map((x) => html`<option value="${x.id}" ${x.id === me?.teamId ? 'selected' : ''}>${x.name}</option>`)}</select></label>` : ''}
      ${s.teamMode === 'assigned' ? html`<p class="hint">${myTeam() ? t('game.yourTeam', { name: myTeam().name }) : t('join.assigned')}</p>` : ''}</div>`;

  const question = () => {
    const c = s.cur; if (!c) return '';
    const answered = myAns != null;
    const left = remaining();
    return html`<div class="row between mb"><span class="pill gold">${t('game.question', { i: c.index + 1, n: s.total })}</span>${c.open && !timeUp ? ring(left, c.durationSec) : html`<span class="pill warn">${answered ? t('game.sent') : t('game.timeUp')}</span>`}</div>
      <div class="card qbox">${c.ref ? html`<span class="pill cat">${c.ref}</span>` : ''}<h2>${c.prompt}</h2>${mediaBlock(c)}</div>
      ${optionsView(c, { picked: myAns ? myAns.choice : -1, interactive: c.open && !timeUp && !answered, dim: answered || timeUp })}
      ${answered ? html`<p class="center muted mt">✓ ${t('game.waitReveal')}${s.answeredCount != null ? ' · ' + t('game.answered', { a: s.answeredCount, n: players.length }) : ''}</p>` : ''}`;
  };

  const reveal = () => {
    const c = s.cur, r = s.reveal || {};
    const ok = me?.lastOk, pts = me?.lastPts || 0;
    const rank = standings(players), pos = rank.findIndex((p) => p.id === uid) + 1;
    const ts = teamStandings(players, teams);
    return html`<div class="result ${ok ? 'good' : 'miss'}"><div style="font-size:2.4rem">${ok ? '🎉' : ok === false ? '😅' : '⏱️'}</div><h2>${ok ? t('game.right') : ok === false ? t('game.wrong') : t('game.noAnswer')}</h2>${ok ? html`<div class="pts">+${pts}</div>` : ''}${r.fastest ? html`<p class="small muted" style="margin:0">⚡ ${t('game.fastest', { nick: r.fastest.nick, t: fastestLabel(r.fastest.ms) })}</p>` : ''}</div>
      <div class="card qbox mt"><h3>${c.prompt}</h3></div>
      ${optionsView(c, { correct: r.correct, counts: r.counts, interactive: false, picked: myAns ? myAns.choice : -1 })}
      ${r.explanation ? html`<div class="card mt"><b class="gold">💡</b> ${r.explanation}</div>` : ''}
      <h3 class="mt2">${t('game.ranking')} · <span class="gold">#${pos}</span></h3>${lbList(rank, uid, { limit: 5 })}
      ${pos > 5 ? html`<ol class="lb"><li class="me"><span class="pos">${pos}</span><span class="nm">${me?.nick}</span><span class="sc">${me?.score}</span></li></ol>` : ''}
      ${ts.length > 1 ? html`<h3 class="mt">${t('game.teams')}</h3>${lbList(ts.map((x) => ({ ...x, nick: x.name })), me?.teamId || '', { limit: 4, colorOf: (x) => x.color })}` : ''}
      <p class="center muted mt">${t('game.nextSoon')}</p>`;
  };

  const ended = () => {
    const rank = standings(players), pos = rank.findIndex((p) => p.id === uid) + 1, ts = teamStandings(players, teams).filter((x) => x.members > 0);
    const total = s.total || 0;
    const nb = (res?.newBadges || []).map((b) => BADGES.find((x) => x.id === b)).filter(Boolean);
    return html`<div class="center"><h1>${t('game.finished')}</h1></div>
      ${podium(rank)}
      <div class="card center gold-edge"><div class="muted">${t('game.yourPos')}</div><div class="bignum">#${pos}<span class="muted small"> / ${rank.length}</span></div>
        <div class="row wrap mt" style="justify-content:center"><span class="pill gold">⭐ ${me?.score || 0} ${t('common.pts')}</span><span class="pill ok">✓ ${me?.correct || 0}/${total}</span></div>
        ${res ? html`<p class="small muted mt" style="margin-bottom:0">${t('game.addedRank', { n: res.pointsGained })}</p>` : loggedIn() ? html`<p class="small muted mt" style="margin-bottom:0">…</p>` : html`<p class="small muted mt" style="margin-bottom:0">${t('join.guest')} <a href="#/login">${t('auth.login')}</a></p>`}</div>
      ${nb.length ? html`<div class="card mt center"><h3>${t('game.newBadges')}</h3><div class="row wrap" style="justify-content:center">${nb.map((b) => html`<div class="center"><div class="badge-ic">${b.icon}</div><div class="small">${t('badge.' + b.id)}</div></div>`)}</div></div>` : ''}
      ${ts.length > 1 ? html`<h3 class="mt2">${t('game.teams')}</h3>${lbList(ts.map((x) => ({ ...x, nick: x.name })), me?.teamId || '', { colorOf: (x) => x.color })}` : ''}
      <button class="btn gold block mt" data-act="share">📤 ${t('game.share')}</button>
      ${rated ? html`<p class="center muted mt">❤️ ${t('game.thanks')}</p>` : html`<form class="card mt" id="rateForm"><h3>${t('game.rate')}</h3><div class="stars">${[1, 2, 3, 4, 5].map((n) => html`<button type="button" data-star="${n}" class="${n <= stars ? 'on' : ''}">⭐</button>`)}</div>
        <label class="field mt"><span>${t('game.comment')}</span><input name="comment" maxlength="200"></label><button class="btn block" ${stars ? '' : 'disabled'}>${t('game.sendRating')}</button></form>`}
      <a class="btn ghost block mt" href="#/">${t('common.home')}</a>`;
  };

  // ----- temporizador local (solo visual; los puntos se calculan con la hora del servidor) -----
  function remaining() { if (!s?.cur) return 0; return Math.max(0, s.cur.durationSec - (Date.now() - startLocal) / 1000); }
  function tick() {
    if (!s || s.status !== 'question' || !s.cur?.open) return;
    const left = remaining();
    updateRing(el, left, s.cur.durationSec);
    const sec = Math.ceil(left);
    if (left > 0 && left <= 5 && !myAns && sec !== tick.last) { sfx.tick(); tick.last = sec; }
    if (left <= 0 && !timeUp) { timeUp = true; render(true); }
  }
  tick.last = -1;

  function onSession(d) {
    const prev = s; s = d;
    if (!s) { setHtml(el, html`<div class="game"><div class="card center empty"><span class="big">🤷</span>${t('game.gone')}<div class="mt"><a class="btn" href="#/">${t('common.home')}</a></div></div></div>`); return; }
    const idx = s.status === 'question' ? s.cur?.index : -1;
    if (s.status === 'question' && idx !== lastIdx) {
      lastIdx = idx; timeUp = false; myAns = null; tick.last = -1; sfx.start();
      const oa = s.cur.openedAt, d2 = Math.abs(Date.now() - oa);
      startLocal = d2 < 4000 ? oa : Date.now();
      unAns(); unAns = db.onDoc(`sessions/${sid}/answers/${idx}_${uid}`, (a) => { myAns = a; render(); });
    }
    if (s.status === 'reveal' && prev?.status !== 'reveal') { setTimeout(() => (me?.lastOk ? sfx.good() : me?.lastOk === false ? sfx.bad() : 0), 150); }
    if (s.status === 'ended' && !unRes.set && loggedIn()) { unRes.set = 1; unRes = Object.assign(db.onDoc(`results/${uid}_${sid}`, (r) => { res = r; render(true); }), { set: 1 }); }
    render();
  }

  const subs = [
    db.onDoc(`sessions/${sid}`, onSession),
    db.onDoc(`sessions/${sid}/players/${uid}`, (p) => { if (!p && s) { go('/join/' + s.code); return; } me = p; render(); }),
    db.onList(`sessions/${sid}/players`, {}, (l) => { players = l; render(); }),
    db.onList(`sessions/${sid}/teams`, {}, (l) => { teams = l; render(); }),
  ];
  timer = setInterval(tick, 250);
  const offs = [
    on(el, 'click', '[data-choice]', async (e, b) => {
      if (myAns || timeUp || !s?.cur?.open) return;
      sfx.unlock();
      const choice = Number(b.dataset.choice); myAns = { choice, pending: true }; render(true);
      try { await submitAnswer(sid, uid, s.cur.index, choice); } catch (ex) { console.error(ex); myAns = null; toast(t('err.generic'), 'err'); render(true); }
    }),
    on(el, 'click', '[data-act="mute"]', () => { setMuted(!isMuted()); sfx.unlock(); render(true); }),
    on(el, 'change', '[data-act="team"]', async (e, sel) => { await db.update(`sessions/${sid}/players/${uid}`, { teamId: sel.value }); }),
    on(el, 'click', '[data-star]', (e, b) => { stars = Number(b.dataset.star); render(true); }),
    on(el, 'submit', '#rateForm', async (e) => { e.preventDefault(); const f = formData(e.target); try { await rate(sid, uid, stars, f.comment); rated = true; render(true); } catch { toast(t('err.generic'), 'err'); } }),
    on(el, 'click', '[data-act="share"]', () => { const rank = standings(players), pos = rank.findIndex((p) => p.id === uid) + 1; shareResult({ title: s.title, nick: me?.nick || '', rank: pos, players: rank.length, score: me?.score || 0, correct: me?.correct || 0, total: s.total }); }),
  ];
  render();
  return () => { clearInterval(timer); subs.forEach((f) => f()); offs.forEach((f) => f()); unAns(); typeof unRes === 'function' && unRes(); };
}
