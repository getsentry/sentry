import {createRoot} from 'react-dom/client';
import {createBrowserRouter} from 'react-router';
import {RouterProvider} from 'react-router/dom';
import {wrapCreateBrowserRouter} from '@sentry/react';
import * as Sentry from '@sentry/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {NuqsAdapter} from 'nuqs/adapters/react-router/v8';

import {setApiNavigate} from 'sentry/api';
import {commonInitialization} from 'sentry/bootstrap/commonInitialization';
import {initializeSdk} from 'sentry/bootstrap/initializeSdk';
import {DocumentTitleManager} from 'sentry/components/sentryDocumentTitle/documentTitleManager';
import {registerOverride} from 'sentry/overrideRegistry';
import type {Config} from 'sentry/types/system';
import {DEFAULT_QUERY_CLIENT_CONFIG} from 'sentry/utils/queryClientConfig';
import {createReactRouter3Navigate} from 'sentry/utils/useNavigate';

import {routes} from 'admin/routes';
import {SuperuserAccessCategory} from 'getsentry/overrides/superuserAccessCategory';

export function init(config: Config) {
  initializeSdk(config);

  // Initialize the config store after the SDK, so we can log errors to Sentry during config initialization if needed
  commonInitialization(config);
  registerOverride('component:superuser-access-category', SuperuserAccessCategory);
}

const queryClient = new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG);

const sentryCreateBrowserRouter = wrapCreateBrowserRouter(createBrowserRouter);
const router = sentryCreateBrowserRouter(routes);

setApiNavigate(createReactRouter3Navigate(router));

// Swaps the favicon set by the admin.html template so _admin tabs are
// distinguishable from regular Sentry tabs.
function setAdminFavicon() {
  const faviconNode = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!faviconNode) {
    return;
  }
  const url = new URL(faviconNode.href);
  url.pathname = url.pathname.replace(/\/[^/]+$/, '/favicon-admin.png');
  faviconNode.type = 'image/png';
  faviconNode.href = url.toString();
}

export function renderApp() {
  setAdminFavicon();

  const rootEl = document.getElementById('blk_router')!;
  const root = createRoot(rootEl);
  root.render(
    <QueryClientProvider client={queryClient}>
      <DocumentTitleManager defaultTitle="_admin">
        <NuqsAdapter defaultOptions={{shallow: false}}>
          <RouterProvider router={router} useTransitions={false} />
        </NuqsAdapter>
      </DocumentTitleManager>
    </QueryClientProvider>
  );
}

// Make the sentry client available to the configurations beforeSend
window.Sentry = Sentry;
