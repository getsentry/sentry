import {useEffect, useState} from 'react';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import {wrapCreateBrowserRouterV6} from '@sentry/react';
import {ReactQueryDevtools} from '@tanstack/react-query-devtools';
import {NuqsAdapter} from 'nuqs/adapters/react-router/v6';

import {AppQueryClientProvider} from 'sentry/appQueryClient';
import {CommandPaletteProvider} from 'sentry/components/commandPalette/context';
import {FrontendVersionProvider} from 'sentry/components/frontendVersionContext';
import {DocumentTitleManager} from 'sentry/components/sentryDocumentTitle/documentTitleManager';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {SENTRY_RELEASE_VERSION, USE_REACT_QUERY_DEVTOOL} from 'sentry/constants';
import {preload} from 'sentry/router/preload';
import {RouteConfigProvider} from 'sentry/router/routeConfigContext';
import {routes} from 'sentry/router/routes';
import {DANGEROUS_SET_REACT_ROUTER_6_HISTORY} from 'sentry/utils/browserHistory';

function buildRouter() {
  const sentryCreateBrowserRouter = wrapCreateBrowserRouterV6(createBrowserRouter);
  const router = sentryCreateBrowserRouter(routes());
  DANGEROUS_SET_REACT_ROUTER_6_HISTORY(router);

  return router;
}

export default function Main() {
  const [router] = useState(buildRouter);

  useEffect(() => {
    preload(router.routes, window.location.pathname);
  }, [router.routes]);

  return (
    <AppQueryClientProvider>
      <DocumentTitleManager>
        <FrontendVersionProvider releaseVersion={SENTRY_RELEASE_VERSION ?? null}>
          <ThemeAndStyleProvider>
            <NuqsAdapter defaultOptions={{shallow: false}}>
              <CommandPaletteProvider>
                <RouteConfigProvider value={router.routes}>
                  <RouterProvider router={router} />
                </RouteConfigProvider>
              </CommandPaletteProvider>
            </NuqsAdapter>
            {USE_REACT_QUERY_DEVTOOL && (
              <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
            )}
          </ThemeAndStyleProvider>
        </FrontendVersionProvider>
      </DocumentTitleManager>
    </AppQueryClientProvider>
  );
}
