import type {TestNotificationOptions} from 'sentry/serviceWorker/types';

export async function showNotification(
  sw: ServiceWorkerGlobalScope,
  data: {
    options: TestNotificationOptions;
    title: string;
  }
): Promise<unknown> {
  if (Notification.permission === 'granted') {
    await sw.registration.showNotification(data.title, data.options);
    return 'Notification Sent';
  }
  return 'Permission denied';
}
