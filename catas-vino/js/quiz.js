/* Categorías de vino y generación automática de preguntas a partir del catálogo.
   Las etiquetas se ven en el idioma del panel; el texto de la pregunta que se guarda va siempre en catalán
   (el contenido se escribe una sola vez, en el idioma principal). */
import { shuffle } from './util.js';
import { t, tMain } from './i18n.js';

const core = (key, unit) => ({ key, unit, get label() { return t('q.l.' + key); }, get q() { return tMain('q.p.' + key); } });
export const CORE_CATS = [core('variety'), core('abv', ' %'), core('winery'), core('origin'), core('wood'), core('aging'), core('vintage')];

const GENERIC = {
  variety: ['Tempranillo', 'Garnatxa', 'Albariño', 'Verdejo', 'Mencía', 'Monastrell', 'Godello', 'Cabernet Sauvignon', 'Syrah', 'Chardonnay', 'Macabeu', 'Xarel·lo', 'Carinyena', 'Sumoll'],
  origin: ['Rioja', 'Ribera del Duero', 'Rías Baixas', 'Rueda', 'Priorat', 'Jumilla', 'Bierzo', 'Toro', 'Penedès', 'Navarra', 'Valdeorras', 'Somontano', 'Empordà', 'Montsant', 'Terra Alta'],
  wood: ['Roure francès', 'Roure americà', 'Sense fusta (acer inoxidable)', 'Castanyer', 'Roure hongarès', 'Roure francès i americà'],
  aging: ['Sense criança en barrica', '6 mesos en barrica', '12 mesos en barrica', '18 mesos en barrica', '24 mesos en barrica', '36 mesos en barrica'],
};

export function allCats(extra = []) {
  return [...CORE_CATS, ...extra.map((e) => ({ key: e.key, label: e.label, q: tMain('q.p.custom', { label: e.label }), custom: true }))];
}

const fmtAbv = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

function distractors(key, correct, wines, wineId) {
  const set = new Set();
  const norm = (s) => String(s).trim();
  const target = norm(correct);
  const others = wines.filter((w) => w.id !== wineId).map((w) => norm(w.attrs?.[key] ?? '')).filter(Boolean);
  shuffle([...new Set(others)]).forEach((v) => { if (v !== target && set.size < 3) set.add(v); });
  if (key === 'abv') {
    const base = parseFloat(String(correct).replace(',', '.'));
    if (!Number.isNaN(base)) for (const d of shuffle([-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2])) { const v = fmtAbv(base + d); if (v !== target && !set.has(v) && set.size < 3) set.add(v); }
  } else if (key === 'vintage') {
    const base = parseInt(correct, 10);
    if (!Number.isNaN(base)) for (const d of shuffle([-3, -2, -1, 1, 2, 3])) { const v = String(base + d); if (v !== target && !set.has(v) && set.size < 3) set.add(v); }
  } else if (GENERIC[key]) {
    shuffle(GENERIC[key]).forEach((v) => { if (v !== target && !set.has(v) && set.size < 3) set.add(v); });
  }
  return [...set];
}

/** Crea una pregunta a partir de un vino y una categoría. Devuelve null si el vino no tiene ese dato. */
export function questionFor(wine, key, wines, cats = CORE_CATS) {
  const value = wine.attrs?.[key];
  if (value == null || String(value).trim() === '') return null;
  const cat = cats.find((c) => c.key === key) || { q: tMain('q.p.generic') };
  const display = key === 'abv' ? fmtAbv(parseFloat(String(value).replace(',', '.'))) : String(value).trim();
  const wrong = distractors(key, display, wines, wine.id);
  const options = shuffle([display, ...wrong]);
  const suffix = cat.unit || '';
  return {
    prompt: cat.q, options: options.map((o) => o + (suffix && key === 'abv' ? suffix : '')),
    correct: options.indexOf(display), category: key, wineId: wine.id, ref: '', durationSec: 20, points: 100, explanation: '', image: '',
    mapQuery: '',
  };
}
