import {useState} from 'react';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import {wrapCreateBrowserRouterV6} from '@sentry/react';
import {ReactQueryDevtools} from '@tanstack/react-query-devtools';
import {NuqsAdapter} from 'nuqs/adapters/react-router/v6';

import {AppQueryClientProvider} from 'sentry/appQueryClient';
import {CommandPaletteProvider} from 'sentry/components/commandPalette/context';
import {FrontendVersionProvider} from 'sentry/components/frontendVersionContext';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {SENTRY_RELEASE_VERSION, USE_REACT_QUERY_DEVTOOL} from 'sentry/constants';
import {routes} from 'sentry/routes';
import {DANGEROUS_SET_REACT_ROUTER_6_HISTORY} from 'sentry/utils/browserHistory';

function buildRouter() {
  const sentryCreateBrowserRouter = wrapCreateBrowserRouterV6(createBrowserRouter);
  const router = sentryCreateBrowserRouter(routes());
  DANGEROUS_SET_REACT_ROUTER_6_HISTORY(router);

  return router;
}

function Main() {
  const [router] = useState(buildRouter);

  return (
    <AppQueryClientProvider>
      <FrontendVersionProvider releaseVersion={SENTRY_RELEASE_VERSION ?? null}>
        <ThemeAndStyleProvider>
          <NuqsAdapter defaultOptions={{shallow: false}}>
            <CommandPaletteProvider>
              <RouterProvider router={router} />
            </CommandPaletteProvider>
          </NuqsAdapter>
          {USE_REACT_QUERY_DEVTOOL && (
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
          )}
        </ThemeAndStyleProvider>
      </FrontendVersionProvider>
    </AppQueryClientProvider>
  );
}

export default Main;
