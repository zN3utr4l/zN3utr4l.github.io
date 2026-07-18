// Kill-switch for the old PumpLog PWA service worker.
// The PWA used to be deployed at this scope (/PumpLog/) with a Workbox SW whose
// navigation fallback served the cached app shell for EVERY url under the scope
// — including privacy.html and delete-account.html, which therefore showed the
// old web app instead of the legal pages. Browsers that still hold that
// registration fetch this file on their next update check: it installs, clears
// all caches, unregisters itself and reloads open clients so the real page
// finally comes from the network. Keep this file deployed indefinitely.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    } catch { /* best-effort */ }
    await self.registration.unregister()
    const clients = await self.clients.matchAll({ type: 'window' })
    for (const client of clients) {
      try { client.navigate(client.url) } catch { /* best-effort */ }
    }
  })())
})
// No fetch handler on purpose: navigations fall through to the network.
