// Aquaculture Alerts Service Worker for Notification Handling & Offline PWA support
const CACHE_NAME = 'aquaculture-alerts-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle notification click: focus existing window or open a new one
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background Push listener (for Web Push API when server-side VAPID push is configured)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || '🚨 Aquaculture Farm Alert';
    const options = {
      body: data.body || 'A high-risk water quality or fish health event occurred.',
      icon: data.icon || '/icon.svg',
      badge: '/icon.svg',
      tag: data.tag || 'aquaculture-alert',
      data: data,
      requireInteraction: true,
      vibrate: [200, 100, 200],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('Error handling push event:', err);
  }
});
