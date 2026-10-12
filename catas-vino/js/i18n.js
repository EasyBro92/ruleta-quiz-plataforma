/* Traducciones: se cargan solo las del idioma elegido (y el castellano de respaldo) */
let dict = {}, fallback = null;
export async function loadLang(l) {
  if (!fallback) fallback = (await import('./locales/es.js')).default;
  try { dict = l === 'es' ? fallback : (await import(`./locales/${l}.js`)).default; } catch { dict = fallback; }
}
export const t = (k, v) => {
  let s = dict[k] ?? fallback?.[k] ?? k;
  if (v) for (const [a, b] of Object.entries(v)) s = s.split('{' + a + '}').join(b);
  return s;
};
