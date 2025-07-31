import {useState} from 'react';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import {wrapCreateBrowserRouterV6} from '@sentry/react';
import {ReactQueryDevtools} from '@tanstack/react-query-devtools';

import {AppQueryClientProvider} from 'sentry/appQueryClient';
import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {USE_REACT_QUERY_DEVTOOL} from 'sentry/constants';
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
      <ThemeAndStyleProvider>
        <OnboardingContextProvider>
          <SentryTrackingProvider>
            <RouterProvider router={router} />
          </SentryTrackingProvider>
        </OnboardingContextProvider>
        {USE_REACT_QUERY_DEVTOOL && (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        )}
      </ThemeAndStyleProvider>
    </AppQueryClientProvider>
  );
}

export default Main;
