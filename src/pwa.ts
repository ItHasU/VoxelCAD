/**
 * Enregistrement du service worker (PWA).
 *
 * Ignoré en dev (HMR) et sur `file://` : les service workers exigent un
 * contexte sécurisé (http(s)/localhost). En production servie, il rend l'app
 * installable et disponible hors ligne. `sw.js` est un fichier `public/`, donc
 * servi tel quel à la racine (jamais inliné dans l'index.html autonome).
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Échec de l’enregistrement du service worker :', err);
    });
  });
}
