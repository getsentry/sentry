import * as Sentry from '@sentry/react';

import type {ResponseMessage} from 'sentry/serviceWorker/types';

type RequestCallback = (error: unknown, result: unknown) => void;

/**
 * A class to send messages to the service worker.
 *
 * Messages must match either the EventMessageType or RequestMessageType.
 *
 * Use EventMessage's to signal that something has happened.
 * Use RequestMessage's to request a value, or perform an action and wait for a response.
 */
export class ServiceWorkerController<
  EventMessageType extends {name: string; type: 'event'},
  RequestMessageType extends {name: string; type: 'request'},
> {
  _outstandingRequests = new Map<string, RequestCallback>();

  constructor() {
    navigator.serviceWorker.addEventListener('message', event =>
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
      )
    );
  }

  /**
   * Resolve the service worker to post to.
   *
   * A page loaded while uncontrolled (first visit, hard reload, or right after
   * an update takes over) has no `controller`. This worker only exchanges
   * messages — it never intercepts fetches — so it doesn't need to control the
   * page; the active worker for the scope is the correct, race-free target.
   */
  private getWorker(): Promise<ServiceWorker | null> {
    if (navigator.serviceWorker.controller) {
      return Promise.resolve(navigator.serviceWorker.controller);
    }
    return navigator.serviceWorker.ready.then(registration => registration.active);
  }

  public postMessage(message: EventMessageType | RequestMessageType): Promise<unknown> {
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
        // message.type === 'request'
        const messageId = crypto.randomUUID();
        Sentry.getActiveSpan()?.setAttribute('messageId', messageId);
        return new Promise((resolve, reject) => {
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
                if (error) {
                  // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
                  reject(error);
                } else {
                  resolve(result);
                }
              }
            )
          );
          worker.postMessage({...message, messageId});
        });
      }
    );
  }
}

/**
 * An abstract class to process messages from the service worker
 *
 * Implement the processEvent and processRequest methods to messages
 * Feel free to implement multiple instances of this that handle different sets
 * of messages.
 * Each instance can handle the same message in different ways. Therefore be
 * cautious of duplicating logic.
 */
export abstract class ServiceWorkerClient<
  EventMessageType extends {type: 'event'},
  RequestMessageType extends {type: 'request'},
> {
  constructor() {
    navigator.serviceWorker.addEventListener('message', event =>
      Sentry.startSpan(
        {
          name: 'service-worker.client',
          op: 'sw.onmessage',
          attributes: {
            type: event.data.type,
            name: event.data.name,
            messageId: event.data.messageId,
          },
        },
        async () => {
          if (event.data.type === 'event') {
            return this.processEvent(event.data);
          }
          if (event.data.type === 'request') {
            const messageId = event.data.messageId;
            try {
              const data = await this.processRequest(event.data);
              return navigator.serviceWorker.controller?.postMessage({
                type: 'response',
                messageId,
                data,
              } satisfies ResponseMessage);
            } catch (error) {
              return navigator.serviceWorker.controller?.postMessage(
                {
                  type: 'response',
                  messageId,
                  error,
                } satisfies ResponseMessage,
                {
                  transfer: [error as Transferable],
                }
              );
            }
          }
        }
      )
    );
  }

  // Example:
  // if (event.name === 'user.login') {
  //   return this.processUserLogin(event);
  // }
  abstract processEvent(_event: EventMessageType): void;

  // Example:
  // switch (event.name) {
  //   case 'trigger.test-notification':
  //     return Promise.resolve(undefined);
  // }
  abstract processRequest(_event: RequestMessageType): unknown | Promise<unknown>;
}
