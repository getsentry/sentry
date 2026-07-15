import * as Sentry from '@sentry/browser';

import type {ResponseMessage} from 'sentry/serviceWorker/types';
import {fetchClientConfig} from 'sentry/serviceWorker/worker/client-config';
import {DEBUG_LOGGING, log} from 'sentry/serviceWorker/worker/constants';
import {handleInboundEvent} from 'sentry/serviceWorker/worker/handleInboundEvent';
import {handleInboundRequest} from 'sentry/serviceWorker/worker/handleInboundRequest';
import {initializeSentry} from 'sentry/serviceWorker/worker/initializeSentry';

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      // Force activation to happen without waiting for the current worker to
      // have zero clients. This worker instance will activate and claim all
      // the clients for itself.
      sw.skipWaiting(),
      fetchClientConfig().then(initializeSentry),
    ]).then(() => {
      log('didInstall');
    })
  );
});

sw.addEventListener('activate', event => {
  log('onActivate');

  event.waitUntil(sw.clients.claim());
});

sw.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  log('onUnhandledRejection');
  fetchClientConfig()
    .then(initializeSentry)
    .then(() => {
      Sentry.captureException(event.reason);
    });
});

sw.addEventListener('message', event => {
  if (!event.data || typeof event.data !== 'object') {
    return;
  }
  event.waitUntil(
    fetchClientConfig()
      .then(initializeSentry)
      .then(() =>
        Sentry.startSpan(
          {
            name: 'service-worker.worker.onMessage',
            op: 'sw.onmessage',
            attributes: {
              type: event.data.type,
              name: event.data.name,
              messageId: event.data.messageId,
            },
          },
          async () => {
            if (DEBUG_LOGGING) {
              // eslint-disable-next-line no-console
              console.log('service-worker.worker.onMessage');
            }

            switch (event.data.type) {
              case 'event': {
                await handleInboundEvent(sw, event.data);
                break;
              }
              case 'request': {
                try {
                  const data = await handleInboundRequest(sw, event.data);
                  event.source?.postMessage({
                    type: 'response',
                    messageId: event.data.messageId,
                    data,
                  } satisfies ResponseMessage);
                } catch (error) {
                  event.source?.postMessage({
                    type: 'response',
                    messageId: event.data.messageId,
                    error,
                  } satisfies ResponseMessage);
                }
                break;
              }
            }
          }
        )
      )
  );
});

sw.addEventListener('notificationclick', (event: NotificationEvent) => {
  if (!event.notification || typeof event.notification !== 'object') {
    return;
  }
  event.waitUntil(
    Sentry.startSpan(
      {
        name: 'service-worker.worker.onNotificationclick',
        op: 'sw.notificationclick',
        attributes: {
          tag: event.notification.tag,
          navigateTo: event.notification.data?.navigateTo,
        },
      },
      async () => {
        event.notification.close();

        if (!('data' in event.notification)) {
          log('onNotificationclick', {attributes: {data: 'isUndefined'}});
          return;
        }

        if ('navigateTo' in event.notification.data) {
          const {pathname, query = {}} = event.notification.data.navigateTo as {
            pathname: string;
            query?: Record<string, string>;
          };
          const windowClients = await sw.clients.matchAll({type: 'window'});
          for (const windowClient of windowClients) {
            const windowUrl = new URL(windowClient.url);
            if (windowUrl.pathname === pathname && 'focus' in windowClient) {
              log('onNotificationclick.navigateTo', {
                attributes: {client: 'focus', url: windowClient.url},
              });
              return windowClient.focus();
            }
          }

          const targetUrl = new URL(pathname, sw.location.origin);
          Object.entries(query).forEach(([key, value]) => {
            targetUrl.searchParams.set(key, value);
          });

          log('onNotificationclick.navigateTo', {
            attributes: {client: 'openWindow', url: targetUrl.toString()},
          });
          return sw.clients.openWindow(targetUrl);
        }
        return;
      }
    )
  );
});
