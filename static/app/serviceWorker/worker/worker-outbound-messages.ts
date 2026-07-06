import * as Sentry from '@sentry/browser';

import type {EventMessage, RequestMessage} from 'sentry/serviceWorker/types';

type RequestCallback = (error: unknown, result: unknown) => void;

const outstandingRequests = new Map<string, RequestCallback>();

export function initOutboundHandler(sw: ServiceWorkerGlobalScope) {
  sw.addEventListener('message', event => {
    event.waitUntil(
      Sentry.startSpan(
        {
          name: 'service-worker.worker.outbound-messages',
          op: 'sw.onmessage',
          attributes: {
            type: event.data.type,
            name: event.data.name,
            messageId: event.data.messageId,
          },
        },
        () => {
          if (event.data.type === 'response' && event.data.messageId) {
            outstandingRequests.get(event.data.messageId)?.(
              event.data.data,
              event.data.error
            );
            outstandingRequests.delete(event.data.messageId);
          }
          return Promise.resolve();
        }
      )
    );
  });
}

export function postMessage(message: EventMessage | RequestMessage) {
  return Sentry.startSpan(
    {
      name: 'service-worker.worker.outbound-messages',
      op: 'sw.postMessage',
      attributes: {
        type: message.type,
        name: message.name,
      },
    },
    () => {
      if (message.type === 'event') {
        return navigator.serviceWorker.controller?.postMessage(message);
      }
      if (message.type === 'request') {
        return new Promise((resolve, reject) => {
          const messageId = crypto.randomUUID();
          Sentry.getActiveSpan()?.setAttribute('messageId', messageId);
          outstandingRequests.set(messageId, (error, result) =>
            Sentry.startSpan(
              {
                name: 'service-worker.worker.outbound-messages',
                op: 'sw.postMessage.request.callback',
                attributes: {
                  name: message.name,
                  messageId,
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
          return navigator.serviceWorker.controller?.postMessage({
            ...message,
            messageId,
          });
        });
      }
    }
  );
}
