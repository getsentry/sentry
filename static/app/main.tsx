import {useEffect, useState} from 'react';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import {wrapCreateBrowserRouterV6} from '@sentry/react';
import {TanStackDevtools} from '@tanstack/react-devtools';
import {formDevtoolsPlugin} from '@tanstack/react-form-devtools';
import {pacerDevtoolsPlugin} from '@tanstack/react-pacer-devtools';
import {ReactQueryDevtoolsPanel} from '@tanstack/react-query-devtools';
import {NuqsAdapter} from 'nuqs/adapters/react-router/v6';

import {setApiNavigate} from 'sentry/api';
import {AppQueryClientProvider} from 'sentry/appQueryClient';
import {CommandPaletteProvider} from 'sentry/components/commandPalette/ui/cmdk';
import {FrontendVersionProvider} from 'sentry/components/frontendVersionContext';
import {DocumentTitleManager} from 'sentry/components/sentryDocumentTitle/documentTitleManager';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {USE_TANSTACK_DEVTOOL} from 'sentry/constants';
import {SENTRY_RELEASE_VERSION} from 'sentry/constants/sdk';
import {preload} from 'sentry/router/preload';
import {RouteConfigProvider} from 'sentry/router/routeConfigContext';
import {routes} from 'sentry/router/routes';
import {ServiceWorkerProvider} from 'sentry/serviceWorker/client/serviceWorkerContext';
import {createReactRouter3Navigate} from 'sentry/utils/useNavigate';

function buildRouter() {
  const sentryCreateBrowserRouter = wrapCreateBrowserRouterV6(createBrowserRouter);
  const router = sentryCreateBrowserRouter(routes());
  setApiNavigate(createReactRouter3Navigate(router));

  return router;
}

export function Main() {
  const [router] = useState(buildRouter);

  useEffect(() => {
    preload(router.routes, window.location.pathname);
  }, [router.routes]);

  return (
    <AppQueryClientProvider>
      <DocumentTitleManager>
        <FrontendVersionProvider releaseVersion={SENTRY_RELEASE_VERSION ?? null}>
          <ServiceWorkerProvider>
            <ThemeAndStyleProvider>
              <NuqsAdapter defaultOptions={{shallow: false}}>
                <CommandPaletteProvider>
                  <RouteConfigProvider value={router.routes}>
                    <RouterProvider router={router} />
                  </RouteConfigProvider>
                </CommandPaletteProvider>
              </NuqsAdapter>
              {USE_TANSTACK_DEVTOOL && (
                <TanStackDevtools
                  config={{position: 'bottom-right'}}
                  plugins={[
                    {
                      name: 'TanStack Query',
                      render: <ReactQueryDevtoolsPanel />,
                    },
                    formDevtoolsPlugin(),
                    pacerDevtoolsPlugin(),
                  ]}
                />
              )}
            </ThemeAndStyleProvider>
          </ServiceWorkerProvider>
        </FrontendVersionProvider>
      </DocumentTitleManager>
    </AppQueryClientProvider>
  );
}
