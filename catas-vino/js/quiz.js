/* Categorías de vino y generación automática de preguntas a partir del catálogo */
import { shuffle } from './util.js';

export const CORE_CATS = [
  { key: 'variety', label: 'Variedad de uva', q: '¿Qué variedad de uva es este vino?' },
  { key: 'abv', label: 'Graduación alcohólica', q: '¿Qué graduación alcohólica tiene este vino?', unit: ' %' },
  { key: 'winery', label: 'Bodega', q: '¿De qué bodega es este vino?' },
  { key: 'origin', label: 'Origen', q: '¿De qué región o denominación de origen es?' },
  { key: 'wood', label: 'Madera de la barrica', q: '¿En qué tipo de madera ha envejecido?' },
  { key: 'aging', label: 'Crianza', q: '¿Qué tipo de crianza ha tenido?' },
  { key: 'vintage', label: 'Añada', q: '¿De qué añada (año de cosecha) es?' },
];

const GENERIC = {
  variety: ['Tempranillo', 'Garnacha', 'Albariño', 'Verdejo', 'Mencía', 'Monastrell', 'Godello', 'Cabernet Sauvignon', 'Syrah', 'Chardonnay', 'Macabeo', 'Graciano'],
  origin: ['Rioja', 'Ribera del Duero', 'Rías Baixas', 'Rueda', 'Priorat', 'Jumilla', 'Bierzo', 'Toro', 'Penedès', 'Navarra', 'Valdeorras', 'Somontano'],
  wood: ['Roble francés', 'Roble americano', 'Sin madera (acero inoxidable)', 'Castaño', 'Roble húngaro', 'Roble francés y americano'],
  aging: ['Sin crianza en barrica', '6 meses en barrica', '12 meses en barrica', '18 meses en barrica', '24 meses en barrica', '36 meses en barrica'],
};

export function allCats(extra = []) {
  return [...CORE_CATS, ...extra.map((e) => ({ key: e.key, label: e.label, q: `¿Cuál es el dato «${e.label}» de este vino?`, custom: true }))];
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
  const cat = cats.find((c) => c.key === key) || { q: '¿Cuál es el dato de este vino?' };
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
