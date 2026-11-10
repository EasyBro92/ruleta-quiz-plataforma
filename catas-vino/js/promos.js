// Cartells d'esdeveniments que s'ensenyen en obrir l'app (finestra emergent + targeta a la portada).
// Hi ha dues fonts, i es poden barrejar:
//  1) data/promos.json: els que es publiquen amb el codi (funcionen per a tothom, sense compte ni servidor);
//  2) les catas de l'editor amb «Promociona-la en obrir l'app» marcat i una foto (agafen sol la data, el preu i la reserva).
// Un cartell deixa de sortir quan comença l'esdeveniment.
const FOTO = /^img\/promos\/[\w.-]+$/;
const VIST = 'catas_promo_vist';      // sessionStorage: els que ja han sortit en aquesta obertura de l'app
const FET = 'catas_promo_fet';        // localStorage: els que ja s'han fet servir (toc a reservar): no tornen a saltar sols

const ms = (v) => { const n = typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(n) ? n : 0; };

function neta(p) {
  if (!p || typeof p.id !== 'string' || typeof p.title !== 'string') return null;
  const imatges = (Array.isArray(p.images) ? p.images : []).filter((s) => FOTO.test(s)).slice(0, 4)
    .map((src, i) => ({ src, alt: String((p.alt || [])[i] || p.title).slice(0, 220) }));
  const inici = ms(p.startsAt), fi = ms(p.until) || inici;
  if (!imatges.length || !inici || !fi) return null;
  return { id: p.id, title: p.title.slice(0, 80), start: inici, end: fi, price: String(p.price || '').slice(0, 20), images: imatges, cata: '', msg: String(p.msg || '').slice(0, 300) };
}

/** Baixa data/promos.json. Si no hi és o falla, llista buida. */
export async function cargarPromos() {
  try {
    const r = await fetch('data/promos.json', { cache: 'no-cache' });
    if (!r.ok) return [];
    const j = await r.json();
    return (Array.isArray(j.promos) ? j.promos : []).map(neta).filter(Boolean);
  } catch { return []; }
}

/** Les catas publicades amb la casella marcada i foto. Les fotos de l'editor ja són imatges completes (no rutes). */
export function promosDeCatas(catas) {
  return (catas || []).filter((c) => c && c.promo === true && c.published !== false && c.image && ms(c.startsAt))
    .map((c) => ({
      id: 'cata:' + c.id, title: String(c.title || ''), start: ms(c.startsAt), end: ms(c.startsAt),
      price: c.price ? `${c.price} €` : '', cata: String(c.id), msg: '',
      images: [c.image, c.image2].filter(Boolean).map((src) => ({ src, alt: String(c.title || '') })),
    }));
}

/** Els que encara no han començat, el més proper primer (com a molt 3). */
export const actives = (llista, ara = Date.now()) => llista.filter((p) => p.end > ara).sort((a, b) => a.start - b.start).slice(0, 3);

const llegir = (st, k) => { try { return JSON.parse(st.getItem(k) || '[]'); } catch { return []; } };
const guardar = (st, k, id) => { try { const l = llegir(st, k); if (!l.includes(id)) { l.push(id); st.setItem(k, JSON.stringify(l.slice(-30))); } } catch { /* sense emmagatzematge: no passa res */ } };

/** El primer que toca ensenyar sol: no ha sortit en aquesta sessió i no s'ha fet servir. */
export const perAutomatic = (llista) => llista.find((p) => !llegir(sessionStorage, VIST).includes(p.id) && !llegir(localStorage, FET).includes(p.id)) || null;
export const marcarVist = (id) => guardar(sessionStorage, VIST, id);
export const marcarFet = (id) => guardar(localStorage, FET, id);
