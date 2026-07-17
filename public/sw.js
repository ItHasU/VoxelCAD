/*
 * Service worker VoxelCAD.
 *
 * L'app de production est un unique index.html autonome (HTML+CSS+JS inlinés) :
 * la mettre en cache suffit à la faire fonctionner hors ligne. On précache la
 * coquille + les icônes, puis on sert « cache d'abord » avec repli réseau, en
 * mettant en cache au vol les requêtes GET rencontrées (runtime caching).
 *
 * Le nom de cache est versionné : à chaque déploiement, changer CACHE purge
 * l'ancien contenu à l'activation.
 */
const CACHE = 'voxelcad-v1';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // addAll échouerait en bloc si une ressource manque : on tolère les absences.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          // Ne met en cache que les réponses valides de même origine.
          if (response.ok && new URL(request.url).origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          // Hors ligne et non caché : pour une navigation, on sert la coquille.
          if (request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });
    }),
  );
});
