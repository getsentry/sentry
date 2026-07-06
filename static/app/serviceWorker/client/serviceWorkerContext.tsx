import {createContext, useContext, useEffect} from 'react';

import {ServiceWorkerController} from 'sentry/serviceWorker/client/serviceWorkerInterface';
import {serviceWorkerRegister} from 'sentry/serviceWorker/client/serviceWorkerRegister';
import type {EventMessage, RequestMessage} from 'sentry/serviceWorker/types';

function getWorkerUrl(): string {
  return window.__SENTRY_DEV_UI ? '/entrypoints/service-worker.js' : '/service-worker.js';
}

const Context = createContext({
  controller: new ServiceWorkerController<EventMessage, RequestMessage>(),
  // client: new ServiceWorkerClient<EventMessage, RequestMessage>(),
});

export function ServiceWorkerProvider({children}: {children: React.ReactNode}) {
  const context = useContext(Context);

  useEffect(() => {
    serviceWorkerRegister(getWorkerUrl(), () => {
      console.log('posting worker.init');
      console.log('have controller?', navigator.serviceWorker.controller ? 'yes' : 'no');

      context.controller.postMessage({
        initialData: window.__initialData,
        name: 'worker.init',
        sentryVersion: window.__SENTRY__VERSION,
        type: 'event',
      } satisfies EventMessage);
    });
  }, [context.controller]);

  return <Context.Provider value={context}>{children}</Context.Provider>;
}

export function useServiceWorker() {
  return useContext(Context);
}
