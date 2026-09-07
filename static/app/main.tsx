import {lazy, Suspense, useEffect, useState} from 'react';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import {wrapCreateBrowserRouterV6} from '@sentry/react';
import {MotionConfig} from 'framer-motion';
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
import {useColorscheme} from 'sentry/utils/useColorscheme';
import {createReactRouter3Navigate} from 'sentry/utils/useNavigate';

// Keep the production check at the import site so DefinePlugin can remove the
// dynamic import from Rspack's production module graph.
const SentryTanStackDevtools =
  process.env.NODE_ENV !== 'production' && USE_TANSTACK_DEVTOOL
    ? lazy(() =>
        import('sentry/components/tanstackDevtools').then(module => ({
          default: module.SentryTanStackDevtools,
        }))
      )
    : null;

function buildRouter() {
  const sentryCreateBrowserRouter = wrapCreateBrowserRouterV6(createBrowserRouter);
  const router = sentryCreateBrowserRouter(routes());
  setApiNavigate(createReactRouter3Navigate(router));

  return router;
}

export function Main() {
  const [router] = useState(buildRouter);
  useColorscheme();

  useEffect(() => {
    preload(router.routes, window.location.pathname);
  }, [router.routes]);

  return (
    <MotionConfig reducedMotion="user">
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
                {SentryTanStackDevtools ? (
                  <Suspense fallback={null}>
                    <SentryTanStackDevtools />
                  </Suspense>
                ) : null}
              </ThemeAndStyleProvider>
            </ServiceWorkerProvider>
          </FrontendVersionProvider>
        </DocumentTitleManager>
      </AppQueryClientProvider>
    </MotionConfig>
  );
}
