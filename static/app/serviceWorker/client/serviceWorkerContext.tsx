import {createContext, useContext, useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {useFrontendVersion} from 'sentry/components/frontendVersionContext';
import {isServiceWorkerSupported} from 'sentry/serviceWorker/client/isServiceWorkerSupported';
import {ServiceWorkerController} from 'sentry/serviceWorker/client/serviceWorkerInterface';

const DEBUG_LOGGING = false;

function log(message: string, options?: Sentry.metrics.MetricOptions) {
  Sentry.metrics.count(`service-worker.register.${message}`, 1, options);
  if (DEBUG_LOGGING) {
    // eslint-disable-next-line no-console
    console.log(`service-worker.register.${message}`);
  }
}

function getWorkerUrl(): string {
  return window.__SENTRY_DEV_UI ? '/entrypoints/service-worker.js' : '/service-worker.js';
}

const Context = createContext({
  controller: new ServiceWorkerController(),
});

export function ServiceWorkerProvider({children}: {children: React.ReactNode}) {
  const context = useContext(Context);

  useRegisterServiceWorker();
  useServiceWorkerUpdateCheck();
  useLogControllerChangeEvent();

  return <Context.Provider value={context}>{children}</Context.Provider>;
}

/**
 * @public
 * Use the service worker controller to send messages to the service worker.
 *
 * @example
 * const {controller} = useServiceWorker();
 * controller.postMessage({name: 'ping', type: 'event'});
 */
export function useServiceWorker() {
  return useContext(Context);
}

/**
 * Register a service worker and send event `worker.init` to the newest worker
 * available.
 */
function useRegisterServiceWorker() {
  useEffect(() => {
    if (!isServiceWorkerSupported()) {
      log('not-supported');
      return;
    }

    navigator.serviceWorker
      // https://rspack.rs/guide/features/web-workers
      .register(getWorkerUrl(), {scope: '/'})
      .then(registration => {
        log('registered', {
          attributes: {
            // An old version could be active while the new instance is incoming
            active: registration.active ? 'true' : 'false',
            // The new instance should be `installing` to start, and should skip
            // `waiting` to become `active` soon.
            installing: registration.installing ? 'true' : 'false',
            waiting: registration.waiting ? 'true' : 'false',
          },
        });

        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          log('statechange', {
            attributes: {
              state: worker.state,
            },
          });
        });
      })
      .catch(error => {
        // AbortErrors from registration are expected (e.g. user navigates away
        // during the initial register call) and produce no stack trace.
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        log('error');
        Sentry.captureException(error);
      });
  }, []);
}

function useServiceWorkerUpdateCheck() {
  const {state} = useFrontendVersion();

  useEffect(() => {
    if (!isServiceWorkerSupported() || state === 'current') {
      return;
    }

    // A long-lived tab only learns about a new worker on the browser's
    // infrequent periodic update check. Re-check whenever the tab becomes
    // visible so a fresh deploy is picked up (trigger: install -> activate ->
    // clients.claim -> controllerchange) as soon as the user returns to it.
    const checkForUpdate = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      log('update-check');
      navigator.serviceWorker.ready
        .then(registration => registration.update())
        .catch(error => {
          // AbortErrors are expected when the user navigates away during an
          // update check — they are not actionable and produce no stack trace.
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }
          // InvalidStateError occurs when the service worker registration
          // becomes stale/invalid while the tab was backgrounded — unactionable.
          if (error instanceof Error && error.name === 'InvalidStateError') {
            return;
          }
          Sentry.captureException(error);
        });
    };

    document.addEventListener('visibilitychange', checkForUpdate);
    return () => {
      document.removeEventListener('visibilitychange', checkForUpdate);
    };
  }, [state]);
}

function useLogControllerChangeEvent() {
  useEffect(() => {
    if (!isServiceWorkerSupported()) {
      return;
    }

    // Log whenever controllerchange happens, which means we have a new worker
    // ready to listen to handle fetch and push requests.
    // This event means that users have multiple tabs open at the same time, and
    // the new workers are taking control of the pages.
    const handler = () => log('controllerchange');

    navigator.serviceWorker.addEventListener('controllerchange', handler);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handler);
    };
  }, []);
}
