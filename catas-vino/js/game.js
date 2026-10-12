/* Lógica del juego en directo.
   El presentador (su dispositivo) actúa de "árbitro": abre cada pregunta, la revela y calcula los puntos.
   Los participantes solo escriben su propia respuesta. */
import { db } from './store.js';
import { CONFIG } from './config.js';
import { joinCode, clamp, rid } from './util.js';

export const TEAM_COLORS = ['#b32a4d', '#3e6fbf', '#d6af5c', '#3fa57c', '#9b59b6', '#e67e22', '#16a0a8', '#c0617a'];
const sp = (sid) => `sessions/${sid}`;

export async function findSessionByCode(code) {
  const list = await db.list('sessions', { where: [['code', '==', String(code).trim().toUpperCase()]] });
  const live = list.filter((s) => s.status !== 'ended');
  return (live.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]) || null;
}

/** Crea la partida: copia las preguntas elegidas y deja todo en la sala de espera. */
export async function createSession({ title, cataId, questions, teamMode, tables = [], createdBy }) {
  let code = joinCode(4);
  for (let i = 0; i < 15; i++) { const ex = await findSessionByCode(code); if (!ex) break; code = joinCode(4); }
  const sid = rid();
  const ops = [
    ['set', sp(sid), { code, title, cataId: cataId || '', createdBy, createdAt: db.ts(), status: 'lobby', teamMode, total: questions.length, qIndex: -1, cur: null, reveal: null, final: null, answeredCount: 0 }],
  ];
  questions.forEach((q, i) => {
    const { id, createdAt, ...rest } = q;
    ops.push(['set', `${sp(sid)}/qs/${i}`, { ...rest, index: i, sourceId: id || '' }]);
  });
  tables.forEach((name, i) => ops.push(['set', `${sp(sid)}/teams/t${i + 1}`, { name, color: TEAM_COLORS[i % TEAM_COLORS.length], code: joinCode(3), kind: 'table', createdAt: db.ts() }]));
  await db.batch(ops);
  return { sid, code };
}

export async function addTeam(sid, name, kind = 'free') {
  const teams = await db.list(`${sp(sid)}/teams`);
  const id = 't' + rid(5);
  await db.set(`${sp(sid)}/teams/${id}`, { name, color: TEAM_COLORS[teams.length % TEAM_COLORS.length], code: kind === 'table' ? joinCode(3) : '', kind, createdAt: db.ts() });
  return id;
}

export async function joinSession(sid, uid, { nick, teamId = '', registered = false, adult = true, lang = 'es' }) {
  const p = `${sp(sid)}/players/${uid}`;
  const ex = await db.get(p);
  if (ex) { await db.update(p, { nick, teamId: teamId || ex.teamId || '', lang }); return; }
  await db.set(p, { uid, nick, teamId, score: 0, correct: 0, answered: 0, lastPts: 0, lastOk: null, registered, adult, lang, joinedAt: db.ts() });
}

export async function submitAnswer(sid, uid, index, choice) {
  await db.set(`${sp(sid)}/answers/${index}_${uid}`, { uid, index, choice, at: db.ts() });
}

export async function rate(sid, uid, stars, comment) {
  await db.set(`${sp(sid)}/ratings/${uid}`, { uid, stars, comment: comment || '', createdAt: db.ts() });
}

// ---------- acciones del presentador ----------
export async function startQuestion(sid, index) {
  const q = await db.get(`${sp(sid)}/qs/${index}`);
  if (!q) throw new Error('no-question');
  await db.update(sp(sid), {
    status: 'question', qIndex: index, reveal: null, answeredCount: 0,
    cur: { index, prompt: q.prompt, options: q.options, image: q.image || '', lat: q.lat ?? null, lon: q.lon ?? null, ref: q.ref || '', category: q.category || '', durationSec: q.durationSec || CONFIG.game.defaultSeconds, points: q.points || CONFIG.game.basePoints, open: true, openedAt: db.ts() },
  });
}

const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

/** Cierra la pregunta, reparte puntos (fijos + bonus por rapidez) y muestra la respuesta correcta. */
export async function revealQuestion(sid) {
  const s = await db.get(sp(sid));
  if (!s || s.status !== 'question' || !s.cur) return;
  const i = s.cur.index;
  const [q, answers, players] = await Promise.all([db.get(`${sp(sid)}/qs/${i}`), db.list(`${sp(sid)}/answers`, { where: [['index', '==', i]] }), db.list(`${sp(sid)}/players`)]);
  const dur = (s.cur.durationSec || CONFIG.game.defaultSeconds) * 1000;
  const base = s.cur.points || CONFIG.game.basePoints;
  const bonusMax = (base * CONFIG.game.speedBonusMax) / 100;
  const byId = new Map(players.map((p) => [p.id, p]));
  const counts = q.options.map(() => 0);
  const ops = []; let fastest = null; const answered = new Set();
  for (const a of answers) {
    const p = byId.get(a.uid); if (!p || answered.has(a.uid)) continue;
    answered.add(a.uid);
    const ms = clamp((a.at || 0) - (s.cur.openedAt || 0), 0, dur);
    const ok = a.choice === q.correct;
    if (counts[a.choice] != null) counts[a.choice]++;
    const pts = ok ? Math.round(base + bonusMax * (1 - ms / dur)) : 0;
    ops.push(['update', `${sp(sid)}/answers/${a.id}`, { ok, pts, ms }]);
    ops.push(['update', `${sp(sid)}/players/${a.uid}`, { score: db.inc(pts), correct: db.inc(ok ? 1 : 0), answered: db.inc(1), lastPts: pts, lastOk: ok }]);
    if (ok && (!fastest || ms < fastest.ms)) fastest = { nick: p.nick, ms };
  }
  for (const p of players) if (!answered.has(p.id)) ops.push(['update', `${sp(sid)}/players/${p.id}`, { lastPts: 0, lastOk: null }]);
  for (const part of chunk(ops, 400)) await db.batch(part);
  await db.update(sp(sid), { status: 'reveal', 'cur.open': false, reveal: { index: i, correct: q.correct, explanation: q.explanation || '', counts, fastest: fastest ? { nick: fastest.nick, ms: fastest.ms } : null } });
}

export async function nextOrEnd(sid) {
  const s = await db.get(sp(sid));
  if (!s) return;
  if (s.qIndex + 1 >= s.total) return endSession(sid);
  return startQuestion(sid, s.qIndex + 1);
}

// ---------- clasificaciones ----------
export function standings(players) {
  return [...players].sort((a, b) => (b.score || 0) - (a.score || 0) || (b.correct || 0) - (a.correct || 0) || (a.joinedAt || 0) - (b.joinedAt || 0));
}
export function teamStandings(players, teams) {
  return teams.map((t) => {
    const m = players.filter((p) => p.teamId === t.id);
    return { ...t, score: m.reduce((a, p) => a + (p.score || 0), 0), members: m.length };
  }).filter((t) => t.members > 0 || t.kind === 'table').sort((a, b) => b.score - a.score);
}

/** Termina la partida, guarda el resultado de cada jugador registrado y actualiza el ranking acumulado. */
export async function endSession(sid) {
  const s = await db.get(sp(sid));
  if (!s || s.status === 'ended') return;
  const [players, teams] = await Promise.all([db.list(`${sp(sid)}/players`), db.list(`${sp(sid)}/teams`)]);
  const rank = standings(players);
  const tRank = teamStandings(players, teams);
  const final = { top: rank.slice(0, 10).map((p) => ({ uid: p.id, nick: p.nick, score: p.score || 0, teamId: p.teamId || '' })), teams: tRank.map((t) => ({ id: t.id, name: t.name, color: t.color, score: t.score, members: t.members })), players: rank.length };
  await db.update(sp(sid), { status: 'ended', endedAt: db.ts(), 'cur.open': false, final });
  const ops = [];
  for (let idx = 0; idx < rank.length; idx++) {
    const p = rank[idx];
    if (!p.registered) continue;
    const pos = idx + 1;
    const lb = (await db.get('leaderboard/' + p.id)) || { points: 0, games: 0, wins: 0, badges: [] };
    const badges = new Set(lb.badges || []);
    const before = new Set(badges);
    badges.add('first_game');
    if (pos <= 3 && rank.length >= 3) badges.add('podium');
    if (pos === 1 && rank.length >= 2) badges.add('champion');
    if ((lb.games || 0) + 1 >= 5) badges.add('veteran');
    if (s.total >= 5 && p.correct === s.total) badges.add('perfect');
    const tIdx = p.teamId ? tRank.findIndex((t) => t.id === p.teamId) : -1;
    if (tIdx === 0 && tRank.filter((t) => t.members > 0).length >= 2) badges.add('team_win');
    const gained = (p.score || 0) + (CONFIG.ranking.pointsPerGame || 0);
    ops.push(['set', 'leaderboard/' + p.id, { uid: p.id, nick: p.nick, points: (lb.points || 0) + gained, games: (lb.games || 0) + 1, wins: (lb.wins || 0) + (pos === 1 && rank.length >= 2 ? 1 : 0), badges: [...badges], updatedAt: db.ts() }]);
    ops.push(['set', `results/${p.id}_${sid}`, { uid: p.id, sid, title: s.title, date: Date.now(), score: p.score || 0, rank: pos, players: rank.length, correct: p.correct || 0, total: s.total, teamName: tIdx >= 0 ? tRank[tIdx].name : '', teamRank: tIdx >= 0 ? tIdx + 1 : 0, newBadges: [...badges].filter((b) => !before.has(b)), pointsGained: gained }]);
  }
  for (const part of chunk(ops, 400)) await db.batch(part);
}

export const fastestLabel = (ms) => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
