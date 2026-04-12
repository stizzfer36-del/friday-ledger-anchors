// FlexEdge Service Worker — handles push notifications

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// ── Push notification handler ─────────────────────────────────────────────────
self.addEventListener('push', event => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'FlexEdge', body: event.data?.text() || 'New update' }
  }

  const title = payload.title || 'FlexEdge'
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    tag: payload.tag || 'flexedge-notification',
    data: payload.data || {},
    actions: payload.actions || [],
    requireInteraction: payload.requireInteraction || false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click handler ────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // If app is already open, focus it
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) {
        existing.focus()
        existing.navigate(url)
      } else {
        self.clients.openWindow(url)
      }
    })
  )
})
