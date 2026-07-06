import * as Sentry from '@sentry/browser';

import type {
  EventMessage,
  RequestMessage,
  ResponseMessage,
} from 'sentry/serviceWorker/types';
import {initializeSentry} from 'sentry/serviceWorker/worker/initializeSentry';
import {triggerTestNotification} from 'sentry/serviceWorker/worker/triggerTestNotification';

export function initInboundHandler(sw: ServiceWorkerGlobalScope) {
  sw.addEventListener('message', event => {
    event.waitUntil(
      Sentry.startSpan(
        {
          name: 'service-worker.worker.inbound-handler',
          op: 'sw.onmessage',
          attributes: {
            type: event.data.type,
            name: event.data.name,
            messageId: event.data.messageId,
          },
        },
        async () => {
          console.log('service-worker.worker.inbound-handler', event.data);
          if (event.data.type === 'event') {
            return handleEvent(sw, event.data);
          }
          if (event.data.type === 'request') {
            const source = event.source as Client;
            const client = await sw.clients.get(source.id);
            try {
              const data = await handleRequest(sw, event.data);
              client?.postMessage({
                type: 'response',
                messageId: event.data.messageId,
                data,
              } satisfies ResponseMessage);
            } catch (error) {
              client?.postMessage(
                {
                  type: 'response',
                  messageId: event.data.messageId,
                  error,
                } satisfies ResponseMessage,
                {transfer: [error as Transferable]}
              );
            }
          }
        }
      )
    );
  });
}

function handleEvent(
  _sw: ServiceWorkerGlobalScope,
  message: EventMessage
): void | Promise<void> {
  switch (message.name) {
    case 'worker.init':
      return initializeSentry(message.initialData, message.sentryVersion);
    case 'user.login':
      return Sentry.setUser(message.userIdentity);
    case 'user.logout':
      return Sentry.setUser(null);
  }
}

function handleRequest(
  sw: ServiceWorkerGlobalScope,
  message: RequestMessage
): unknown | Promise<unknown> {
  switch (message.name) {
    case 'trigger.test-notification':
      return triggerTestNotification(sw, message.data);
  }
}
