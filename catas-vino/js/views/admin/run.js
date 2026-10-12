/* Consola del presentador: sala de espera, preguntas en directo, resultados y podio */
import { db } from '../../store.js';
import { go } from '../../state.js';
import { html, setHtml, on, toast, modal, confirmBox, confetti, formData, raw } from '../../util.js';
import { adminTabs } from './ui.js';
import { startQuestion, revealQuestion, nextOrEnd, endSession, addTeam, standings, teamStandings, fastestLabel } from '../../game.js';
import { ring, updateRing, mediaBlock, optionsView, lbList, podium, LETTERS } from '../../ui-game.js';
import { qrSvg } from '../../vendor/qr.js';

const MODE_ES = { off: 'Sin equipos', free: 'Equipos libres', assigned: 'Equipos asignados por ti', table: 'Por mesas' };

export default function view({ el, params }) {
  const sid = params.sid, sp = `sessions/${sid}`;
  let s = null, players = [], teams = [], answers = [], qCur = null, qNext = null, ratings = [];
  let timer = null, startLocal = 0, lastIdx = -2, revealing = false, autoAll = true, acTimer = null, subAns = () => {}, subQ = () => {}, subNext = () => {}, lastSig = '', lastStatus = '', busy = false;

  const joinUrl = (extra = '') => `${location.origin}${location.pathname}#/join/${s.code}${extra}`;
  const screenUrl = () => `${location.origin}${location.pathname}#/screen/${s.code}`;
  const remaining = () => (s?.cur ? Math.max(0, s.cur.durationSec - (Date.now() - startLocal) / 1000) : 0);

  function sig() {
    return JSON.stringify([s, players.map((p) => [p.id, p.nick, p.score, p.teamId, p.lastOk].join(':')), teams.map((x) => x.id + x.name + x.code), answers.length, qCur?.correct, qNext?.prompt, ratings.length, busy]);
  }
  function render(force = false) {
    if (!s) return;
    const sg = sig(); if (!force && sg === lastSig) return; lastSig = sg;
    let body = '';
    if (s.status === 'lobby') body = lobby();
    else if (s.status === 'question') body = question();
    else if (s.status === 'reveal') body = reveal();
    else body = ended();
    setHtml(el, html`${adminTabs('/admin/games')}
      <div class="row between wrap mb"><div><a href="#/admin/games" class="muted small">← Partidas</a><h1 style="margin:0">${s.title}</h1></div>
        <div class="row wrap"><span class="pill gold" style="font-size:1rem">🔑 ${s.code}</span><button class="btn sm" data-act="screen">📺 Pantalla grande</button><button class="btn sm" data-act="copy">🔗 Copiar enlace</button>${s.status !== 'ended' ? html`<button class="btn sm danger" data-act="finish">Terminar</button>` : ''}</div></div>
      ${body}`);
    if (s.status === 'ended' && lastStatus !== 'ended') confetti(100);
    lastStatus = s.status;
  }

  // ---------- sala de espera ----------
  const lobby = () => {
    const tableTeams = teams.filter((x) => x.kind === 'table');
    const canTeams = s.teamMode !== 'off';
    return html`<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));align-items:start">
      <div class="card center"><p class="muted">Que se unan escaneando el QR o entrando en «Jugar» con el código</p><div class="code">${s.code}</div><div class="qr mt">${raw(qrSvg(joinUrl(), { size: 220 }))}</div>
        <p class="small muted mt">${MODE_ES[s.teamMode]} · ${s.total} preguntas</p>
        <button class="btn primary block mt" data-act="start" ${busy ? 'disabled' : ''}>▶ Empezar la cata</button></div>
      <div class="stack"><div class="card"><div class="row between"><h3 style="margin:0">👥 Jugadores (${players.length})</h3></div>
          ${players.length ? html`<div class="mt">${[...players].sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0)).map((p) => html`<div class="row mb"><span class="grow">${p.nick} ${p.registered ? html`<span class="tag">cuenta</span>` : ''}</span>${canTeams ? html`<select data-team="${p.id}" style="max-width:150px"><option value="">Sin equipo</option>${teams.map((x) => html`<option value="${x.id}" ${x.id === p.teamId ? 'selected' : ''}>${x.name}</option>`)}</select>` : ''}<button class="btn sm ghost" data-kick="${p.id}" title="Expulsar">✕</button></div>`)}</div>` : html`<p class="muted mt">Esperando a que entren…</p>`}</div>
        ${canTeams ? html`<div class="card"><h3>Equipos</h3>${teams.length ? html`<div class="row wrap mb">${teams.map((x) => html`<span class="pill" style="border-color:${x.color}">${x.name}${x.kind === 'table' ? ' · ' + x.code : ''} · ${players.filter((p) => p.teamId === x.id).length}</span>`)}</div>` : ''}
          ${s.teamMode !== 'table' ? html`<form class="row" id="teamForm"><input name="name" placeholder="Nombre del equipo" required><button class="btn">Añadir</button></form>` : ''}
          ${tableTeams.length ? html`<button class="btn sm mt" data-act="qrtables">🖨 QR de las mesas</button>` : ''}</div>` : ''}</div></div>`;
  };

  // ---------- pregunta en juego ----------
  const question = () => {
    const c = s.cur;
    return html`<div class="row between mb"><span class="pill gold">Pregunta ${c.index + 1} de ${s.total}</span><div class="row"><span class="pill">${answers.length}/${players.length} han respondido</span>${c.open ? ring(remaining(), c.durationSec) : ''}</div></div>
      <div class="card qbox">${c.ref ? html`<span class="pill cat">${c.ref}</span>` : ''}<h2>${c.prompt}</h2>${mediaBlock(c)}</div>
      <div class="opts two">${c.options.map((o, i) => html`<div class="opt c${i % 4}"><span class="ltr">${LETTERS[i]}</span><span>${o}</span>${qCur && qCur.correct === i ? html`<span class="cnt">✓ correcta</span>` : ''}</div>`)}</div>
      <div class="row between wrap mt"><label class="check" style="margin:0"><input type="checkbox" id="autoAll" ${autoAll ? 'checked' : ''}><span>Revelar cuando todos hayan respondido</span></label><button class="btn gold" data-act="reveal">Revelar ahora</button></div>`;
  };

  // ---------- resultado de la pregunta ----------
  const reveal = () => {
    const c = s.cur, r = s.reveal || {}, last = s.qIndex + 1 >= s.total;
    const rank = standings(players), ts = teamStandings(players, teams).filter((x) => x.members > 0);
    return html`<div class="card qbox"><h3>${c.prompt}</h3></div>
      ${optionsView(c, { correct: r.correct, counts: r.counts, interactive: false })}
      ${r.explanation ? html`<div class="card mt">💡 ${r.explanation}</div>` : ''}${r.fastest ? html`<p class="muted mt">⚡ Más rápido: ${r.fastest.nick} (${fastestLabel(r.fastest.ms)})</p>` : ''}
      <div class="grid mt" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));align-items:start"><div><h3>Clasificación</h3>${lbList(rank, '', { limit: 8 })}</div>${ts.length > 1 ? html`<div><h3>Equipos</h3>${lbList(ts.map((x) => ({ ...x, nick: x.name })), '', { colorOf: (x) => x.color })}</div>` : ''}</div>
      <div class="sticky-actions">${!last && qNext ? html`<p class="small muted center">Siguiente: ${qNext.ref ? qNext.ref + ' · ' : ''}${qNext.prompt}</p>` : ''}<button class="btn primary block" data-act="next" ${busy ? 'disabled' : ''}>${last ? '🏆 Terminar y mostrar el podio' : 'Siguiente pregunta ▶'}</button></div>`;
  };

  // ---------- final ----------
  const ended = () => {
    const rank = standings(players), ts = teamStandings(players, teams).filter((x) => x.members > 0);
    const avg = ratings.length ? (ratings.reduce((a, r) => a + r.stars, 0) / ratings.length).toFixed(1) : null;
    return html`<div class="center"><h2>🏆 Partida terminada</h2></div>${podium(rank)}
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));align-items:start"><div><h3>Clasificación final</h3>${lbList(rank, '', { limit: 15 })}</div>${ts.length > 1 ? html`<div><h3>Equipos</h3>${lbList(ts.map((x) => ({ ...x, nick: x.name })), '', { colorOf: (x) => x.color })}</div>` : ''}</div>
      <div class="card mt"><p class="muted" style="margin:0">✅ Los puntos de los jugadores con cuenta ya se han sumado al ranking acumulado. Jugadores con cuenta: ${players.filter((p) => p.registered).length} de ${players.length}.${avg ? ` Valoración media: ${avg} ⭐ (${ratings.length}).` : ''}</p></div>`;
  };

  // ---------- reloj de la pregunta ----------
  async function tick() {
    if (!s || s.status !== 'question' || !s.cur?.open) return;
    const left = remaining();
    updateRing(el, left, s.cur.durationSec);
    if ((Date.now() - startLocal) / 1000 >= s.cur.durationSec + 0.8 && !revealing) doReveal();
  }
  async function doReveal() {
    if (revealing) return; revealing = true;
    try { await revealQuestion(sid); } catch (e) { console.error(e); toast('No se pudo revelar la respuesta', 'err'); }
    revealing = false;
  }
  function syncAnswered() {
    if (!s || s.status !== 'question') return;
    const n = answers.length;
    if ((s.answeredCount || 0) !== n) { clearTimeout(acTimer); acTimer = setTimeout(() => db.update(sp, { answeredCount: n }).catch(() => {}), 250); }
    if (autoAll && players.length && n >= players.length && !revealing) setTimeout(() => { if (s?.status === 'question') doReveal(); }, 700);
  }

  function onSession(d) {
    s = d;
    if (!s) { toast('La partida no existe', 'err'); go('/admin/games'); return; }
    if (s.status === 'question' && s.cur?.index !== lastIdx) {
      lastIdx = s.cur.index; revealing = false;
      const d2 = Math.abs(Date.now() - s.cur.openedAt); startLocal = d2 < 4000 ? s.cur.openedAt : Date.now();
      subAns(); subAns = db.onList(`${sp}/answers`, { where: [['index', '==', lastIdx]] }, (l) => { answers = l; syncAnswered(); render(); });
      subQ(); subQ = db.onDoc(`${sp}/qs/${lastIdx}`, (q) => { qCur = q; render(); });
      subNext(); qNext = null; if (lastIdx + 1 < s.total) subNext = db.onDoc(`${sp}/qs/${lastIdx + 1}`, (q) => { qNext = q; render(); });
    }
    if (s.status === 'ended' && !subs.ratings) subs.ratings = db.onList(`${sp}/ratings`, {}, (l) => { ratings = l; render(); });
    render();
  }
  const subs = {};
  subs.sess = db.onDoc(sp, onSession);
  subs.players = db.onList(`${sp}/players`, {}, (l) => { players = l; syncAnswered(); render(); });
  subs.teams = db.onList(`${sp}/teams`, {}, (l) => { teams = l; render(); });
  timer = setInterval(tick, 250);

  const run = async (fn, errMsg = 'Ha ocurrido un error') => { busy = true; render(true); try { await fn(); } catch (e) { console.error(e); toast(errMsg, 'err'); } busy = false; render(true); };
  const offs = [
    on(el, 'click', '[data-act="start"]', () => run(() => startQuestion(sid, 0), 'No se pudo empezar')),
    on(el, 'click', '[data-act="reveal"]', () => doReveal()),
    on(el, 'click', '[data-act="next"]', () => run(() => nextOrEnd(sid))),
    on(el, 'change', '#autoAll', (e, c) => { autoAll = c.checked; syncAnswered(); }),
    on(el, 'click', '[data-act="screen"]', () => window.open(screenUrl(), '_blank')),
    on(el, 'click', '[data-act="copy"]', async () => { try { await navigator.clipboard.writeText(joinUrl()); toast('Enlace copiado'); } catch { prompt('Copia este enlace', joinUrl()); } }),
    on(el, 'click', '[data-act="finish"]', async () => { if (await confirmBox('Terminar la partida', 'Se cerrará la partida y se guardarán los puntos de los jugadores con cuenta.', 'Terminar', 'Volver', true)) run(() => endSession(sid)); }),
    on(el, 'change', '[data-team]', async (e, sel) => { await db.update(`${sp}/players/${sel.dataset.team}`, { teamId: sel.value }); }),
    on(el, 'click', '[data-kick]', async (e, b) => { await db.del(`${sp}/players/${b.dataset.kick}`); }),
    on(el, 'submit', '#teamForm', async (e) => { e.preventDefault(); const f = formData(e.target); await addTeam(sid, f.name, 'assigned'); e.target.reset(); }),
    on(el, 'click', '[data-act="qrtables"]', () => {
      modal(html`<h3>QR de las mesas</h3><p class="muted small">Imprímelos (Ctrl/Cmd + P) y colócalos en cada mesa: quien lo escanee entra directamente en su equipo.</p><div class="grid c2">${teams.filter((x) => x.kind === 'table').map((x) => html`<div class="center"><b>${x.name}</b><div class="qr" style="margin:6px auto">${raw(qrSvg(joinUrl('?mesa=' + x.code), { size: 150 }))}</div><div class="small muted">${x.code}</div></div>`)}</div><button class="btn block mt" data-close>Cerrar</button>`);
    }),
  ];
  setHtml(el, html`<div class="empty">…</div>`);
  return () => { clearInterval(timer); clearTimeout(acTimer); Object.values(subs).forEach((f) => f()); subAns(); subQ(); subNext(); offs.forEach((f) => f()); };
}
