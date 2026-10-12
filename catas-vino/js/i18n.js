/* Traducciones: el catalán es el idioma principal y el de respaldo.
   Se carga solo el idioma elegido; si falta una clave, se usa la del catalán. */
export const MAIN_LANG = 'ca';
let dict = {}, fallback = null;
export async function loadLang(l) {
  if (!fallback) fallback = (await import(`./locales/${MAIN_LANG}.js`)).default;
  try { dict = l === MAIN_LANG ? fallback : (await import(`./locales/${l}.js`)).default; } catch { dict = fallback; }
}
const fill = (s, v) => { if (v) for (const [a, b] of Object.entries(v)) s = s.split('{' + a + '}').join(b); return s; };
export const t = (k, v) => fill(dict[k] ?? fallback?.[k] ?? k, v);
/** Siempre en catalán: para el contenido que se guarda y que ven todos los clientes (preguntas, mesas…). */
export const tMain = (k, v) => fill(fallback?.[k] ?? k, v);
