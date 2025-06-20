import {useMemo, useState} from 'react';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import {wrapCreateBrowserRouterV6} from '@sentry/react';
import {ReactQueryDevtools} from '@tanstack/react-query-devtools';

import {AppQueryClientProvider} from 'sentry/appQueryClient';
import {TrackingContextProvider} from 'sentry/components/core/trackingContext';
import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {USE_REACT_QUERY_DEVTOOL} from 'sentry/constants';
import {routes} from 'sentry/routes';
import HookStore from 'sentry/stores/hookStore';
import {DANGEROUS_SET_REACT_ROUTER_6_HISTORY} from 'sentry/utils/browserHistory';

import {buildReactRouter6Routes} from './utils/reactRouter6Compat/router';

function buildRouter() {
  const sentryCreateBrowserRouter = wrapCreateBrowserRouterV6(createBrowserRouter);
  const router = sentryCreateBrowserRouter(buildReactRouter6Routes(routes()));
  DANGEROUS_SET_REACT_ROUTER_6_HISTORY(router);

  return router;
}

function Main() {
  const [router] = useState(buildRouter);
  const useButtonTracking = HookStore.get('react-hook:use-button-tracking')[0];
  const trackingContextValue = useMemo(() => ({useButtonTracking}), [useButtonTracking]);

  return (
    <AppQueryClientProvider>
      <ThemeAndStyleProvider>
        <OnboardingContextProvider>
          <TrackingContextProvider value={trackingContextValue}>
            <RouterProvider router={router} />
          </TrackingContextProvider>
        </OnboardingContextProvider>
        {USE_REACT_QUERY_DEVTOOL && (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        )}
      </ThemeAndStyleProvider>
    </AppQueryClientProvider>
  );
}

export default Main;
