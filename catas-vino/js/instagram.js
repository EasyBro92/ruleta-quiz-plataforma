// Últimas publicaciones de Instagram para la portada.
// Las deja en data/instagram.json una Action de GitHub (.github/workflows/catarsi-instagram.yml en el repo de despliegue),
// que también baja las fotos a img/instagram/: las direcciones que da Instagram caducan en horas.
// Si no hay archivo, está vacío o falla algo, la portada se queda con la foto de siempre (CONFIG.brand.photo).
const LS = 'catas_instagram';

// solo se aceptan fotos de nuestra carpeta y enlaces a instagram.com: el archivo viene del repo, pero no cuesta nada comprobarlo
const limpiar = (lista) => (Array.isArray(lista) ? lista : [])
  .filter((p) => p && typeof p.id === 'string' && /^img\/instagram\/[\w.-]+$/.test(p.img || '') && /^https:\/\/www\.instagram\.com\//.test(p.url || ''))
  .map((p) => ({ id: p.id, img: p.img, url: p.url, caption: String(p.caption || '').slice(0, 160) }))
  .slice(0, 8);

/** Lo último que se vio, para que la portada no «salte» de foto al cargar. */
export function postsGuardados() {
  try { return limpiar(JSON.parse(localStorage.getItem(LS) || '[]')); } catch { return []; }
}

/** Baja el índice. Devuelve la lista (vacía si no hay nada o no hay conexión; entonces vale lo guardado). */
export async function cargarPosts() {
  try {
    const r = await fetch('data/instagram.json', { cache: 'no-cache' });
    if (!r.ok) return null;
    const lista = limpiar((await r.json()).posts);
    try { localStorage.setItem(LS, JSON.stringify(lista)); } catch { /* sin almacenamiento: no pasa nada */ }
    return lista;
  } catch { return null; }
}
