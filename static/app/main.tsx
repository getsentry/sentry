import {useState} from 'react';
// biome-ignore lint/nursery/noRestrictedImports: Will be removed with react router 6
import {Router, RouterContext} from 'react-router';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import {wrapCreateBrowserRouter} from '@sentry/react';
import {ReactQueryDevtools} from '@tanstack/react-query-devtools';

import DemoHeader from 'sentry/components/demo/demoHeader';
import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {USE_REACT_QUERY_DEVTOOL} from 'sentry/constants';
import {routes} from 'sentry/routes';
import ConfigStore from 'sentry/stores/configStore';
import {
  browserHistory,
  DANGEROUS_SET_REACT_ROUTER_6_HISTORY,
} from 'sentry/utils/browserHistory';
import {
  DEFAULT_QUERY_CLIENT_CONFIG,
  QueryClient,
  QueryClientProvider,
} from 'sentry/utils/queryClient';
import {RouteContext} from 'sentry/views/routeContext';

import {buildReactRouter6Routes} from './utils/reactRouter6Compat/router';

/**
 * Renders our compatibility RouteContext.Provider. This will go away with
 * react-router v6.
 */
function renderRouter(props: any) {
  return (
    <RouteContext.Provider value={props}>
      <RouterContext {...props} />
    </RouteContext.Provider>
  );
}

const queryClient = new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG);

function createReactRouter6Routes() {
  const sentryCreateBrowserRouter = wrapCreateBrowserRouter(createBrowserRouter);
  const router = sentryCreateBrowserRouter(buildReactRouter6Routes(routes()));

  if (window.__SENTRY_USING_REACT_ROUTER_SIX) {
    DANGEROUS_SET_REACT_ROUTER_6_HISTORY(router);
  }

  return router;
}

function Main() {
  const [router6] = useState(createReactRouter6Routes);

  return (
    <ThemeAndStyleProvider>
      <QueryClientProvider client={queryClient}>
        <OnboardingContextProvider>
          {ConfigStore.get('demoMode') && <DemoHeader />}
          {window.__SENTRY_USING_REACT_ROUTER_SIX ? (
            <RouterProvider router={router6} />
          ) : (
            <Router history={browserHistory} render={renderRouter}>
              {routes()}
            </Router>
          )}
        </OnboardingContextProvider>
        {USE_REACT_QUERY_DEVTOOL && (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        )}
      </QueryClientProvider>
    </ThemeAndStyleProvider>
  );
}

export default Main;
