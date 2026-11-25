/* Substitui o service worker antigo deste app: remove só os caches dele e se desregistra.
 * O service worker atual é partner-ppr-pca-sw.js. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('partner-ppr-pca-v1')).map(k => caches.delete(k))))
    .then(() => self.registration.unregister()));
});
