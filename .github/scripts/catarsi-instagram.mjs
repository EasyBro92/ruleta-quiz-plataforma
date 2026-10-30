// Catarsi · copia las últimes publicacions d'Instagram a la portada de l'app.
// Lo lanza .github/workflows/catarsi-instagram.yml cada día. Sin dependencias (Node 22).
//  - Renueva el token largo de Instagram (dura 60 días y así se reinicia solo en cada pasada).
//  - Baja las últimas fotos A NUESTRA CARPETA (catas-vino/img/instagram/): las direcciones que da
//    Instagram caducan en horas, no sirven para enseñarlas en una web.
//  - Escribe catas-vino/data/instagram.json, que es lo que lee la app. Solo toca archivos si hay algo nuevo.
// Para probarlo sin Instagram: IG_API=http://localhost:PUERTO apunta a una API simulada.
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'catas-vino');
const JSON_OUT = join(RAIZ, 'data', 'instagram.json');
const IMG_DIR = join(RAIZ, 'img', 'instagram');
const API = (process.env.IG_API || 'https://graph.instagram.com').replace(/\/$/, '');
const TOKEN = (process.env.INSTAGRAM_TOKEN || '').trim();
const MAX = Number(process.env.IG_MAX) || 6;                       // cuántas publicaciones rotan en la portada
const EXCLUIR = (process.env.IG_EXCLUIR || '#sinweb').toLowerCase(); // una publicación con esta etiqueta no sale en la app
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const aviso = (m) => console.log(`::warning::${m}`);
const fallo = (m) => { console.log(`::error::${m}`); process.exit(1); };

if (!TOKEN) {
  // sin token todavía: no es un error, la app sigue con su foto de siempre
  aviso('Falta el secreto INSTAGRAM_TOKEN: no se hace nada (la portada sigue con la foto de siempre).');
  process.exit(0);
}

async function pedir(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  const txt = await r.text();
  let j = null; try { j = JSON.parse(txt); } catch { /* respuesta no JSON */ }
  if (!r.ok) throw new Error(`${r.status} ${(j && j.error && j.error.message) || txt.slice(0, 160)}`);
  return j;
}

// 1) renovar el token. Falla si tiene menos de 24 h (recién creado): no pasa nada, se renueva otro día.
try {
  const j = await pedir(`${API}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(TOKEN)}`);
  const dias = Math.round((j.expires_in || 0) / 86400);
  console.log(`Token renovado: caduca en ${dias} días.`);
  // la renovación devuelve el mismo token; si algún día cambiara, el secreto habría que actualizarlo a mano
  if (j.access_token && j.access_token !== TOKEN) aviso('Instagram ha devuelto un token DISTINTO: actualiza el secreto INSTAGRAM_TOKEN con el nuevo.');
} catch (e) {
  console.log(`Renovación omitida (${e.message}).`);
}

// 2) últimas publicaciones
let lista;
try {
  const campos = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
  const j = await pedir(`${API}/me/media?fields=${campos}&limit=25&access_token=${encodeURIComponent(TOKEN)}`);
  lista = j.data || [];
} catch (e) {
  fallo(`No se pudo leer Instagram (${e.message}). Si dice que el token ha caducado o no es válido, genera uno nuevo y cámbialo en el secreto INSTAGRAM_TOKEN.`);
}

const elegidas = [];
for (const m of lista) {
  const img = m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url;      // de un vídeo se usa su portada
  if (!img || !m.permalink || !m.id) continue;
  if (EXCLUIR && (m.caption || '').toLowerCase().includes(EXCLUIR)) continue;
  elegidas.push({ m, img });
  if (elegidas.length >= MAX) break;
}

// 3) bajar las fotos que aún no están
await mkdir(IMG_DIR, { recursive: true });
await mkdir(dirname(JSON_OUT), { recursive: true });
const previas = existsSync(JSON_OUT) ? JSON.parse(await readFile(JSON_OUT, 'utf8')).posts || [] : [];
const posts = [];
for (const { m, img } of elegidas) {
  const hecha = previas.find((p) => p.id === m.id && existsSync(join(RAIZ, p.img)));
  if (hecha) { posts.push({ ...hecha, caption: limpiar(m.caption), url: m.permalink }); continue; }
  try {
    const r = await fetch(img);
    if (!r.ok) throw new Error(String(r.status));
    const ext = EXT[(r.headers.get('content-type') || '').split(';')[0]] || 'jpg';
    const ruta = `img/instagram/${m.id}.${ext}`;
    await writeFile(join(RAIZ, ruta), Buffer.from(await r.arrayBuffer()));
    posts.push({ id: m.id, img: ruta, url: m.permalink, caption: limpiar(m.caption), ts: m.timestamp });
    console.log(`Nueva foto: ${m.id}`);
  } catch (e) {
    aviso(`No se pudo bajar la foto de ${m.id} (${e.message}); se salta.`);
  }
}

function limpiar(c) { return (c || '').replace(/\s+/g, ' ').trim().slice(0, 160); }

// 4) borrar las fotos que ya no se usan y escribir el índice solo si ha cambiado algo
for (const f of await readdir(IMG_DIR)) {
  if (!posts.some((p) => p.img === `img/instagram/${f}`)) await rm(join(IMG_DIR, f));
}
if (JSON.stringify(previas) === JSON.stringify(posts) && existsSync(JSON_OUT)) {
  console.log('Sin cambios.');
} else {
  await writeFile(JSON_OUT, JSON.stringify({ user: process.env.IG_USER || 'salut_catarsi', actualizado: new Date().toISOString(), posts }, null, 2) + '\n');
  console.log(`Índice escrito con ${posts.length} publicaciones.`);
}
