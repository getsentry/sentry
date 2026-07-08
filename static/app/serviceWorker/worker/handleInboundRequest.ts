import type {RequestMessage} from 'sentry/serviceWorker/types';
import {showNotification} from 'sentry/serviceWorker/worker/showNotification';

export function handleInboundRequest(
  sw: ServiceWorkerGlobalScope,
  message: RequestMessage
): unknown | Promise<unknown> {
  switch (message.name) {
    case 'trigger.test-notification':
      return showNotification(sw, message.data);
  }
}
