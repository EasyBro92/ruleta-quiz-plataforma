/* Lógica del Trivial de vins (estilo Preguntados, en solitario). Sin pantalla: solo reglas y guardado,
   para poder probarla sin navegador.

   Reglas: una ruleta de 6 categorías; cada encerto en una categoría suma un punto (de 3). Al llegar a 3,
   la siguiente pregunta es el «repte de la corona» (nivel difícil): si se acierta, la categoría queda coronada.
   Se empieza con 5 copas: cada error quita una y cada corona da una más (máximo 6). Ganas con las 6 coronas.
   Calibrado con 4.000 partidas simuladas por nivel de acierto: quien acierta 3 de cada 4 gana ~1 de cada 4; 85 %: 7 de cada 10;
   65 %: casi nunca gana pero corona ~1 categoría. */
import { CATS } from './trivial-data.js';

export const VIDES_INICIALS = 5;
export const VIDES_MAX = 6;
export const ENCERTS_CORONA = 3;
export const TEMPS = 20;
export const KEYS = CATS.map((c) => c.key);

const K_GAME = 'catas_trivial_game';
const K_STATS = 'catas_trivial_stats';
const VERSIO = 1;

// ---------- guardado (si no hay almacenamiento, el juego funciona igual pero no recuerda nada) ----------
const llegeix = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
const escriu = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* nada */ } };

export function estatsBuits() { return { partides: 0, victories: 0, millor: 0, millorRatxa: 0, encerts: 0, preguntes: 0, vistes: {} }; }
export function llegirEstats() { const s = llegeix(K_STATS); return s && typeof s === 'object' ? { ...estatsBuits(), ...s, vistes: { ...(s.vistes || {}) } } : estatsBuits(); }
export function desarEstats(s) { escriu(K_STATS, s); }
export function carregar() {
  const g = llegeix(K_GAME);
  if (!g || g.v !== VERSIO || g.fi || !Array.isArray(g.corones) || !g.progres) return null;
  if (g.actual) { const c = CATS.find((x) => x.key === g.actual.cat); if (!c || !c.qs[g.actual.idx]) g.actual = null; }
  return g;
}
export function guardar(st) { escriu(K_GAME, st); }
export function esborrar() { try { localStorage.removeItem(K_GAME); } catch { /* nada */ } }

// ---------- partida ----------
export function novaPartida() {
  return {
    v: VERSIO, vides: VIDES_INICIALS, punts: 0, ratxa: 0, millorRatxa: 0, encerts: 0, errors: 0, preguntes: 0,
    corones: [], progres: Object.fromEntries(KEYS.map((k) => [k, 0])), usades: Object.fromEntries(KEYS.map((k) => [k, []])),
    comodins: { meitat: 1, canvia: 1 }, actual: null, fi: null,
  };
}

export const lliures = (st) => KEYS.filter((k) => !st.corones.includes(k));
export const triaCategoria = (st, rnd = Math.random) => { const l = lliures(st); return l[Math.floor(rnd() * l.length)]; };
/** Categoría que ya tiene 3 aciertos y espera su prueba de corona (null si ninguna). */
export const repteCorona = (st) => KEYS.find((k) => !st.corones.includes(k) && st.progres[k] >= ENCERTS_CORONA) || null;

const barreja = (a, rnd) => { const o = [...a]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };

/** Escoge una pregunta: nunca repite en la misma partida y, entre partidas, prefiere las que aún no has visto. */
function escullPregunta(st, estats, key, corona, rnd) {
  const cat = CATS.find((c) => c.key === key);
  const usades = new Set(st.usades[key]);
  const vistes = new Set(estats.vistes[key] || []);
  let lliure = cat.qs.map((q, i) => i).filter((i) => !usades.has(i));
  if (!lliure.length) { st.usades[key] = []; lliure = cat.qs.map((q, i) => i); }   // (no pasa en una partida normal) por si acaso, se vuelve a empezar
  let pool = lliure.filter((i) => !vistes.has(i));
  if (!pool.length) { estats.vistes[key] = []; pool = lliure; }          // las has visto todas: se empieza otra vuelta
  const volNivell = corona || rnd() < 0.3 ? 2 : 1;                      // la corona siempre es difícil; el resto, sobre todo fáciles
  const delNivell = pool.filter((i) => cat.qs[i][0] === volNivell);
  const triades = delNivell.length ? delNivell : pool;
  const idx = triades[Math.floor(rnd() * triades.length)];
  st.usades[key].push(idx);
  (estats.vistes[key] = estats.vistes[key] || []).push(idx);
  return idx;
}

/** Deja la pregunta en curso dentro de la partida (st.actual) y la devuelve lista para pintar. */
export function pregunta(st, estats, key, corona = false, rnd = Math.random) {
  const idx = escullPregunta(st, estats, key, corona, rnd);
  st.actual = { cat: key, idx, ordre: barreja([0, 1, 2, 3], rnd), corona: !!corona, ocults: [] };
  return visio(st);
}

/** Lo que ve el jugador: texto, opciones ya barajadas y cuál es la correcta. */
export function visio(st) {
  const a = st.actual; if (!a) return null;
  const cat = CATS.find((c) => c.key === a.cat); const [nivell, prompt, ok, mal, explicacio] = cat.qs[a.idx];
  const totes = [ok, ...mal];
  return { cat: a.cat, idx: a.idx, nivell, prompt, explicacio, corona: a.corona, ocults: a.ocults || [], opcions: a.ordre.map((i) => totes[i]), correcta: a.ordre.indexOf(0) };
}

/** Comodín 50:50: esconde dos respuestas incorrectas. */
export function meitat(st, rnd = Math.random) {
  if (!st.actual || st.comodins.meitat < 1 || st.actual.ocults.length) return false;
  const v = visio(st);
  const males = [0, 1, 2, 3].filter((i) => i !== v.correcta);
  st.actual.ocults = barreja(males, rnd).slice(0, 2).sort();
  st.comodins.meitat--;
  return true;
}

/** Comodín «Canvia»: otra pregunta de la misma categoría y del mismo nivel, sin penalización. */
export function canvia(st, estats, rnd = Math.random) {
  if (!st.actual || st.comodins.canvia < 1) return null;
  const { cat, corona } = st.actual;
  st.comodins.canvia--;
  return pregunta(st, estats, cat, corona, rnd);
}

/** Resuelve la respuesta (triada = posición mostrada, o -1 si se acaba el tiempo). Devuelve qué ha pasado. */
export function respon(st, triada, tempsRestant = 0) {
  const v = visio(st); if (!v) return null;
  const ok = triada === v.correcta;
  const res = { ok, correcta: v.correcta, triada, corona: v.corona, cat: v.cat, coronaGuanyada: false, coronaPerduda: false, repteObert: false, punts: 0, vidaExtra: false, fi: null };
  st.preguntes++; st.actual = null;
  if (ok) {
    st.encerts++; st.ratxa++; st.millorRatxa = Math.max(st.millorRatxa, st.ratxa);
    res.punts = 10 + Math.min(st.ratxa - 1, 5) * 2 + Math.round(Math.max(0, tempsRestant) / 4);
    if (v.corona) {
      st.corones.push(v.cat); st.progres[v.cat] = ENCERTS_CORONA; res.coronaGuanyada = true; res.punts += 50;
      if (st.vides < VIDES_MAX) { st.vides++; res.vidaExtra = true; }
    } else {
      st.progres[v.cat] = Math.min(ENCERTS_CORONA, st.progres[v.cat] + 1);
      res.repteObert = st.progres[v.cat] >= ENCERTS_CORONA;
    }
  } else {
    st.errors++; st.ratxa = 0; st.vides--;
    if (v.corona) { st.progres[v.cat] = ENCERTS_CORONA - 1; res.coronaPerduda = true; }   // perder el reto te deja a un acierto de volver a intentarlo
  }
  st.punts += res.punts;
  if (st.corones.length === KEYS.length) { st.fi = 'guanyada'; const extra = 100 + st.vides * 20; st.punts += extra; res.punts += extra; }
  else if (st.vides <= 0) st.fi = 'perduda';
  res.fi = st.fi;
  return res;
}

/** Cierra la partida: actualiza las estadísticas y borra el guardado. Devuelve si es récord. */
export function tancaPartida(st, estats) {
  const record = st.punts > estats.millor;
  estats.partides++; estats.encerts += st.encerts; estats.preguntes += st.preguntes;
  if (st.fi === 'guanyada') estats.victories++;
  estats.millor = Math.max(estats.millor, st.punts); estats.millorRatxa = Math.max(estats.millorRatxa, st.millorRatxa);
  desarEstats(estats); esborrar();
  return record;
}
