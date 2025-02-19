import {useState} from 'react';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import {wrapCreateBrowserRouterV6} from '@sentry/react';
import {ReactQueryDevtools} from '@tanstack/react-query-devtools';

import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {USE_REACT_QUERY_DEVTOOL} from 'sentry/constants';
import {routes} from 'sentry/routes';
import {DANGEROUS_SET_REACT_ROUTER_6_HISTORY} from 'sentry/utils/browserHistory';
import {
  DEFAULT_QUERY_CLIENT_CONFIG,
  QueryClient,
  QueryClientProvider,
} from 'sentry/utils/queryClient';

import {buildReactRouter6Routes} from './utils/reactRouter6Compat/router';

const queryClient = new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG);

function buildRouter() {
  const sentryCreateBrowserRouter = wrapCreateBrowserRouterV6(createBrowserRouter);
  const router = sentryCreateBrowserRouter(buildReactRouter6Routes(routes()));
  DANGEROUS_SET_REACT_ROUTER_6_HISTORY(router);

  return router;
}

function Main() {
  const [router] = useState(buildRouter);

  return (
    <ThemeAndStyleProvider>
      <QueryClientProvider client={queryClient}>
        <OnboardingContextProvider>
          <RouterProvider router={router} />
        </OnboardingContextProvider>
        {USE_REACT_QUERY_DEVTOOL && (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        )}
      </QueryClientProvider>
    </ThemeAndStyleProvider>
  );
}

export default Main;
