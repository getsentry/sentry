import {createRoot} from 'react-dom/client';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import {wrapCreateBrowserRouterV6} from '@sentry/react';
import * as Sentry from '@sentry/react';
import {NuqsAdapter} from 'nuqs/adapters/react-router/v6';

import {commonInitialization} from 'sentry/bootstrap/commonInitialization';
import {initializeSdk} from 'sentry/bootstrap/initializeSdk';
import {DocumentTitleManager} from 'sentry/components/sentryDocumentTitle/documentTitleManager';
import ConfigStore from 'sentry/stores/configStore';
import type {Config} from 'sentry/types/system';
import {DANGEROUS_SET_REACT_ROUTER_6_HISTORY} from 'sentry/utils/browserHistory';
import {
  DEFAULT_QUERY_CLIENT_CONFIG,
  QueryClient,
  QueryClientProvider,
} from 'sentry/utils/queryClient';

import {routes} from 'admin/routes';

export function init(config: Config) {
  initializeSdk(config);

  // Initialize the config store after the SDK, so we can log errors to Sentry during config initialization if needed
  commonInitialization(config);

  ConfigStore.set('getsentry.sendgridApiKey', window.__sendGridApiKey);
}

const queryClient = new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG);

const sentryCreateBrowserRouter = wrapCreateBrowserRouterV6(createBrowserRouter);
const router = sentryCreateBrowserRouter(routes);

DANGEROUS_SET_REACT_ROUTER_6_HISTORY(router);

export function renderApp() {
  const rootEl = document.getElementById('blk_router')!;
  const root = createRoot(rootEl);
  root.render(
    <QueryClientProvider client={queryClient}>
      <DocumentTitleManager>
        <NuqsAdapter defaultOptions={{shallow: false}}>
          <RouterProvider router={router} />
        </NuqsAdapter>
      </DocumentTitleManager>
    </QueryClientProvider>
  );
}

// Make the sentry client available to the configurations beforeSend
window.Sentry = Sentry;
