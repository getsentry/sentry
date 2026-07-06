import type {TestNotificationOptions} from 'sentry/serviceWorker/types';

export async function triggerTestNotification(
  sw: ServiceWorkerGlobalScope,
  data: {
    options: TestNotificationOptions;
    title: string;
  }
): Promise<unknown> {
  if (Notification.permission === 'granted') {
    await sw.registration.showNotification(data.title, data.options);
    return 'Sent test notification';
  }
  return 'Permission denied';
}

export function initNotificationHandler(sw: ServiceWorkerGlobalScope) {
  sw.addEventListener('notificationclick', (event: NotificationEvent) => {
    console.log('On notification click:', event);
    event.notification.close();

    // This looks to see if the current is already open and
    // focuses if it is
    event.waitUntil(
      sw.clients.matchAll({type: 'window'}).then(clientList => {
        for (const client of clientList) {
          const url = new URL(client.url);
          console.log('looking at client', client, url);
          if (url.pathname === '/issues/' && 'focus' in client) {
            return client.focus();
          }
        }
        console.log('no client found, opening window');
        if (sw.clients.openWindow) {
          return sw.clients.openWindow('/');
        }
        return;
      })
    );
  });
}
