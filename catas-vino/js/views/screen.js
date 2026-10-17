/* Pantalla grande (tele o proyector): se abre con #/screen/CÓDIGO y no necesita iniciar sesión */
import { db, auth } from '../store.js';
import { t } from '../i18n.js';
import { CONFIG } from '../config.js';
import { html, setHtml, on, sfx, isMuted, setMuted, celebrate, raw } from '../util.js';
import { standings, teamStandings, findSessionByCode, fastestLabel } from '../game.js';
import { ring, updateRing, mediaBlock, optionsView, lbList, podium, floatEmoji, clearFloat } from '../ui-game.js';
import { qrSvg } from '../vendor/qr.js';

export default function view({ el, params }) {
  const code = params.code.toUpperCase();
  if (!auth.current) { auth.anonymous(); return; }   // la app vuelve a cargar esta pantalla al iniciar sesión
  let sid = null, s = null, players = [], teams = [], timer = null, startLocal = 0, lastIdx = -2, lastSig = '', lastStatus = '', subs = [], stopped = false, nPlayers = -1, seenReact = new Map(), reactReady = false, lastPop = 0;

  const joinUrl = () => `${location.origin}${location.pathname}#/join/${s.code}`;
  const sig = () => JSON.stringify([s?.status, s?.qIndex, s?.cur?.open, s?.reveal?.index, s?.answeredCount, players.map((p) => p.id + ':' + p.score + ':' + p.nick).join(), teams.map((x) => x.id + x.name).join()]);

  function render(force = false) {
    if (!s) return;
    const sg = sig(); if (!force && sg === lastSig) return; lastSig = sg;
    const rank = standings(players), ts = teamStandings(players, teams).filter((x) => x.members > 0 || x.kind === 'table');
    let body = '';
    if (s.status === 'lobby') {
      body = html`<div class="cols" style="margin-top:3vh"><div class="center"><p class="muted">${t('screen.join')}</p><div class="code">${s.code}</div><div class="qr" style="margin-top:2vh">${raw(qrSvg(joinUrl(), { size: Math.min(360, innerHeight * 0.4) }))}</div><p class="muted small" style="margin-top:1vh">${t('screen.orScan')}</p></div>
        <div><h2>👥 ${t('game.players', { n: players.length })}</h2><div class="players">${players.map((p) => html`<span class="pl">${p.nick}</span>`)}</div>
        ${ts.length ? html`<h3 class="mt2">${t('game.teams')}</h3><div class="players">${ts.map((x) => html`<span class="pl" style="border-color:${x.color}">${x.name} · ${x.members}${x.kind === 'table' && x.code ? ' · ' + x.code : ''}</span>`)}</div>` : ''}</div></div>`;
    } else if (s.status === 'question') {
      const c = s.cur;
      body = html`<div class="row between"><span class="pill gold">${t('game.question', { i: c.index + 1, n: s.total })}</span><div class="row">${c.ref ? html`<span class="pill">${c.ref}</span>` : ''}<span class="pill">${t('game.answered', { a: s.answeredCount || 0, n: players.length })}</span>${ring(remaining(), c.durationSec)}</div></div>
        <div class="qtext">${c.prompt}</div>${c.image || c.lat != null ? mediaBlock(c) : ''}${optionsView(c, { interactive: false })}`;
    } else if (s.status === 'reveal') {
      const c = s.cur, r = s.reveal || {};
      body = html`<div class="cols"><div><div class="qtext" style="font-size:1.8em;text-align:left">${c.prompt}</div>${optionsView(c, { correct: r.correct, counts: r.counts, interactive: false })}${r.explanation ? html`<div class="card mt">💡 ${r.explanation}</div>` : ''}${r.fastest ? html`<p class="muted mt">⚡ ${t('game.fastest', { nick: r.fastest.nick, t: fastestLabel(r.fastest.ms) })}</p>` : ''}</div>
        <div><h2>${t('game.ranking')}</h2>${lbList(rank, '', { limit: 8 })}${ts.length > 1 ? html`<h3 class="mt">${t('game.teams')}</h3>${lbList(ts.map((x) => ({ ...x, nick: x.name })), '', { limit: 5, colorOf: (x) => x.color })}` : ''}</div></div>`;
    } else {
      body = html`<div class="center"><h1 style="font-size:2.6em">${t('game.finished')} 🎉</h1></div>${podium(rank)}
        <div class="cols"><div>${lbList(rank, '', { limit: 10 })}</div><div>${ts.length > 1 ? html`<h3>${t('game.teams')}</h3>${lbList(ts.map((x) => ({ ...x, nick: x.name })), '', { limit: 6, colorOf: (x) => x.color })}` : ''}</div></div>`;
    }
    setHtml(el, html`<div class="screen"><div class="row between mb"><div class="brand"><span class="logo">${CONFIG.brand.emoji}</span><span>${s.title}</span></div><div class="row"><span class="pill gold">${s.code}</span><button class="icon-btn" data-act="mute">${isMuted() ? '🔇' : '🔊'}</button></div></div>${body}</div>`);
    if (s.status === 'ended' && lastStatus !== 'ended') celebrate();
    lastStatus = s.status;
  }
  const remaining = () => (s?.cur ? Math.max(0, s.cur.durationSec - (Date.now() - startLocal) / 1000) : 0);
  const tick = () => { if (s?.status === 'question' && s.cur?.open) updateRing(el, remaining(), s.cur.durationSec); };

  (async () => {
    const found = await findSessionByCode(code).catch(() => null);
    if (stopped) return;
    if (!found) { setHtml(el, html`<div class="screen center"><h1>${t('join.notfound')}</h1><p class="muted">${code}</p></div>`); return; }
    sid = found.id;
    subs = [
      db.onDoc(`sessions/${sid}`, (d) => {
        s = d; if (!s) return;
        if (s.status === 'question' && s.cur?.index !== lastIdx) { lastIdx = s.cur.index; sfx.start(); const d2 = Math.abs(Date.now() - s.cur.openedAt); startLocal = d2 < 4000 ? s.cur.openedAt : Date.now(); }
        if (s.status === 'reveal' && lastStatus !== 'reveal') sfx.good();
        render();
      }),
      db.onList(`sessions/${sid}/players`, {}, (l) => { if (nPlayers >= 0 && l.length > nPlayers) sfx.join(); nPlayers = l.length; players = l; render(); }),
      // reacciones del público: la primera lectura solo apunta lo que ya había; después, cada cambio sale flotando
      db.onList(`sessions/${sid}/reactions`, {}, (l) => {
        l.forEach((r) => { const prev = seenReact.get(r.id); seenReact.set(r.id, r.n); if (reactReady && r.n !== prev) { floatEmoji(r.emoji, { big: true }); if (Date.now() - lastPop > 250) { sfx.pop(); lastPop = Date.now(); } } });
        reactReady = true;
      }),
      db.onList(`sessions/${sid}/teams`, {}, (l) => { teams = l; render(); }),
    ];
  })();
  timer = setInterval(tick, 250);
  const off = on(el, 'click', '[data-act="mute"]', () => { setMuted(!isMuted()); sfx.unlock(); render(true); });
  setHtml(el, html`<div class="screen center"><div class="boot-glass">🍷</div></div>`);
  return () => { stopped = true; clearInterval(timer); clearFloat(); subs.forEach((f) => f()); off(); };
}
