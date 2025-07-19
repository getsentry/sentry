import {useState} from 'react';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import {wrapCreateBrowserRouterV6} from '@sentry/react';
import {ReactQueryDevtools} from '@tanstack/react-query-devtools';

import {AppQueryClientProvider} from 'sentry/appQueryClient';
import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {USE_REACT_QUERY_DEVTOOL} from 'sentry/constants';
import {routes} from 'sentry/routes';
import {DANGEROUS_SET_REACT_ROUTER_6_HISTORY} from 'sentry/utils/browserHistory';

import {buildReactRouter6Routes} from './utils/reactRouter6Compat/router';

function buildRouter(SentryHooksProvider?: React.ComponentType<React.PropsWithChildren>) {
  const sentryCreateBrowserRouter = wrapCreateBrowserRouterV6(createBrowserRouter);
  const router = sentryCreateBrowserRouter(
    buildReactRouter6Routes(routes(SentryHooksProvider))
  );
  DANGEROUS_SET_REACT_ROUTER_6_HISTORY(router);

  return router;
}

function Main(props: {
  SentryHooksProvider?: React.ComponentType<React.PropsWithChildren>;
}) {
  const [router] = useState(() => buildRouter(props.SentryHooksProvider));

  return (
    <AppQueryClientProvider>
      <ThemeAndStyleProvider>
        <OnboardingContextProvider>
          <RouterProvider router={router} />
        </OnboardingContextProvider>
        {USE_REACT_QUERY_DEVTOOL && (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        )}
      </ThemeAndStyleProvider>
    </AppQueryClientProvider>
  );
}

export default Main;
