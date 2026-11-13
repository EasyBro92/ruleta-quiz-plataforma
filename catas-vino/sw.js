/* Service worker de la dirección antigua: se borra a sí mismo y lleva a quien tenga la app abierta (o instalada) a la nueva.
   No intercepta nada: todo va a la red, donde index.html redirige. */
const NOVA = 'https://easybro92.github.io/Salut-Catarsi/';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) { const u = new URL(c.url); c.navigate(NOVA + u.search + u.hash).catch(() => {}); }
})()));
