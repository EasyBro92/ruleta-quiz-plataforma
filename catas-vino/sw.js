/* Service worker: guarda los archivos de la app para que abra rápido y funcione sin conexión
   (los datos en vivo siguen necesitando internet). Sube el número de VERSION al publicar cambios. */
const VERSION = 'catas-v9';
const CORE = ['./', './index.html', './css/app.css', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './img/logo-catarsi.png', './img/logo-apertura.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
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
  // Solo archivos de la propia app; Firebase, mapas y demás van directos a la red.
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
