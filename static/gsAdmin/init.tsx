import {createRoot} from 'react-dom/client';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import {wrapCreateBrowserRouterV6} from '@sentry/react';
import * as Sentry from '@sentry/react';

import {commonInitialization} from 'sentry/bootstrap/commonInitialization';
import {initializeSdk} from 'sentry/bootstrap/initializeSdk';
import ConfigStore from 'sentry/stores/configStore';
import type {Config} from 'sentry/types/system';
import {DANGEROUS_SET_REACT_ROUTER_6_HISTORY} from 'sentry/utils/browserHistory';
import {QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';

import {routes6} from 'admin/routes';

export function init(config: Config) {
  initializeSdk(config);

  // Initialize the config store after the SDK, so we can log errors to Sentry during config initialization if needed
  commonInitialization(config);

  ConfigStore.set('getsentry.sendgridApiKey', window.__sendGridApiKey);
}

const queryClient = new QueryClient();

const sentryCreateBrowserRouter = wrapCreateBrowserRouterV6(createBrowserRouter);
const router = sentryCreateBrowserRouter(routes6);

DANGEROUS_SET_REACT_ROUTER_6_HISTORY(router);

export function renderApp() {
  const rootEl = document.getElementById('blk_router')!;
  const root = createRoot(rootEl);
  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

// Make the sentry client available to the configurations beforeSend
window.Sentry = Sentry;
