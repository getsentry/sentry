import type {AllNotificationOptions} from 'sentry/serviceWorker/types';
import {log} from 'sentry/serviceWorker/worker/constants';

export async function showNotification(
  sw: ServiceWorkerGlobalScope,
  data: {
    options: AllNotificationOptions;
    title: string;
  }
): Promise<unknown> {
  if (Notification.permission === 'granted') {
    log('showNotification', {
      attributes: {
        title: data.title,
        navigateTo: data.options.data?.navigateTo,
        options: data.options,
      },
    });
    await sw.registration.showNotification(data.title, data.options);
    log('showNotification.success', {
      attributes: {title: data.title},
    });
    return 'Notification Sent';
  }
  return 'Permission denied';
}
