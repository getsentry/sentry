import {useState} from 'react';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import {wrapCreateBrowserRouterV6} from '@sentry/react';
import {ReactQueryDevtools} from '@tanstack/react-query-devtools';
import {NuqsAdapter} from 'nuqs/adapters/react-router/v6';

import {AppQueryClientProvider} from 'sentry/appQueryClient';
import {FrontendVersionProvider} from 'sentry/components/frontendVersionContext';
import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {SENTRY_RELEASE_VERSION, USE_REACT_QUERY_DEVTOOL} from 'sentry/constants';
import {routes} from 'sentry/routes';
import {SentryTrackingProvider} from 'sentry/tracking';
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
          <OnboardingContextProvider>
            <SentryTrackingProvider>
              <NuqsAdapter defaultOptions={{shallow: false}}>
                <RouterProvider router={router} />
              </NuqsAdapter>
            </SentryTrackingProvider>
          </OnboardingContextProvider>
          {USE_REACT_QUERY_DEVTOOL && (
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
          )}
        </ThemeAndStyleProvider>
      </FrontendVersionProvider>
    </AppQueryClientProvider>
  );
}

export default Main;
