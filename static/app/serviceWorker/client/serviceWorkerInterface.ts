import * as Sentry from '@sentry/react';

import {isServiceWorkerSupported} from 'sentry/serviceWorker/client/isServiceWorkerSupported';
import type {EventMessage, RequestMessage} from 'sentry/serviceWorker/types';

type RequestCallback = (error: unknown, result: unknown) => void;

/**
 * Sends messages from the page to the service worker.
 *
 * Every message must be an `EventMessage` or `RequestMessage` (see `sentry/serviceWorker/types`).
 * Use to notify the worker that something has happened on the page. Or to
 * request something from the worker and wait for a response.
 */
export class ServiceWorkerController {
  _outstandingRequests = new Map<string, RequestCallback>();

  constructor() {
    if (!isServiceWorkerSupported()) {
      return;
    }
    navigator.serviceWorker.addEventListener('message', this._onMessage);
  }

  public dispose() {
    if (!isServiceWorkerSupported()) {
      return;
    }
    navigator.serviceWorker.removeEventListener('message', this._onMessage);
  }

  private _onMessage = (event: MessageEvent) => {
    Sentry.startSpan(
      {
        name: 'service-worker.controller',
        op: 'sw.onmessage',
        attributes: {
          type: event.data.type,
          name: event.data.name,
          messageId: event.data.messageId,
        },
      },
      () => {
        if (event.data.type === 'response' && event.data.messageId) {
          this._outstandingRequests.get(event.data.messageId)?.(
            event.data.error,
            event.data.data
          );
          this._outstandingRequests.delete(event.data.messageId);
        }
      }
    );
  };

  /**
   * Find the service worker that this page should send messages to.
   *
   * Since we only need to post messages & not intercept network requests,
   * we use `navigator.serviceWorker.ready` to get the active worker.
   * We don't need to wait for the page to be controlled by the worker.
   */
  private async getWorker(): Promise<ServiceWorker | null> {
    if (!isServiceWorkerSupported()) {
      throw new Error('Service workers are not supported in this browser');
    }
    // For more read: https://web.dev/articles/service-worker-lifecycle
    const registration = await navigator.serviceWorker.ready;
    return registration.installing ?? registration.waiting ?? registration.active;
  }

  public postMessage(message: EventMessage | RequestMessage): Promise<unknown> {
    return Sentry.startSpan(
      {
        name: 'service-worker.controller',
        op: 'sw.postMessage',
        attributes: {type: message.type, name: message.name},
      },
      async () => {
        switch (message.type) {
          case 'event': {
            const worker = await this.getWorker();
            worker?.postMessage(message);
            return;
          }
          case 'request': {
            const worker = await this.getWorker();
            if (!worker) {
              throw new Error('Service worker not found');
            }
            const messageId = crypto.randomUUID();
            Sentry.getActiveSpan()?.setAttribute('messageId', messageId);
            return new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                this._outstandingRequests.delete(messageId);
                reject(new Error('Request timed out'));
              }, message.timeoutMs ?? 10_000); // 10 seconds

              this._outstandingRequests.set(messageId, (error, result) =>
                Sentry.startSpan(
                  {
                    name: 'service-worker.controller',
                    op: 'sw.postMessage.request.callback',
                    attributes: {
                      name: message.name,
                      messageId,
                      hasError: Boolean(error),
                      hasResult: Boolean(result),
                    },
                  },
                  () => {
                    clearTimeout(timeout);
                    if (error === undefined) {
                      resolve(result);
                    } else {
                      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
                      reject(error);
                    }
                  }
                )
              );

              worker.postMessage({...message, messageId});
            });
          }
        }
      }
    );
  }
}
