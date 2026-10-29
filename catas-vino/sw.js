/* Service worker: guarda los archivos de la app para que abra rápido y funcione sin conexión
   (los datos en vivo siguen necesitando internet). Sube el número de VERSION al publicar cambios. */
const VERSION = 'catas-v13';
const CORE = ['./', './index.html', './css/app.css', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './img/logo-catarsi.png', './img/logo-apertura.png'];

self.addEventListener('install', (e) => {
  // cache: 'reload' → la copia de esta versión se baja del servidor, no de la caché HTTP (que puede ser de la versión anterior)
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const nav = req.mode === 'navigate';
  // GitHub Pages sirve todo con max-age=600: sin 'no-cache' el navegador devolvía archivos de la versión anterior
  // durante 10 minutos y mezclaba versiones. Con 'no-cache' siempre pregunta (304 si no ha cambiado: casi gratis).
  const net = nav ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' });
  e.respondWith(
    net.then((res) => {
      if (!res.ok || res.type !== 'basic') return res;
      const copy = res.clone();                       // se clona ANTES de pasar el cuerpo a la respuesta nueva
      caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
      // la página tampoco debe quedarse con la copia en memoria (max-age=600): al recargar, vuelve a pasar por aquí
      const h = new Headers(res.headers); h.set('Cache-Control', 'no-cache');
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
    }).catch(() => caches.match(req).then((hit) => hit || (nav ? caches.match('./index.html') : Response.error())))
  );
});
