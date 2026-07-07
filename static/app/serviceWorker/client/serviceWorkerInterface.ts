import * as Sentry from '@sentry/react';

import type {EventMessage} from 'sentry/serviceWorker/types';

/**
 * Sends messages from the page to the service worker.
 *
 * Every message must be an `EventMessage` (see `sentry/serviceWorker/types`).
 * Use to notify the worker that something has happened on the page.
 */
export class ServiceWorkerController {
  /**
   * Find the service worker that this page should send messages to.
   *
   * Since we only need to post messages & not intercept network requests,
   * we use `navigator.serviceWorker.ready` to get the active worker.
   * We don't need to wait for the page to be controlled by the worker.
   */
  private async getWorker(): Promise<ServiceWorker | null> {
    if (!('serviceWorker' in navigator)) {
      return null;
    }
    // For more read: https://web.dev/articles/service-worker-lifecycle
    const registration = await navigator.serviceWorker.ready;
    return registration.installing ?? registration.waiting ?? registration.active;
  }

  public postMessage(message: EventMessage): Promise<unknown> {
    return Sentry.startSpan(
      {
        name: 'service-worker.controller',
        op: 'sw.postMessage',
        attributes: {type: message.type, name: message.name},
      },
      async () => {
        const worker = await this.getWorker();
        if (!worker) {
          return;
        }
        if (message.type === 'event') {
          worker.postMessage(message);
          return;
        }
      }
    );
  }
}
