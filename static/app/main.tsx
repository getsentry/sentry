import {Router, RouterContext} from 'react-router';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import {wrapCreateBrowserRouter} from '@sentry/react';
import {ReactQueryDevtools} from '@tanstack/react-query-devtools';

import DemoHeader from 'sentry/components/demo/demoHeader';
import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {USE_REACT_QUERY_DEVTOOL} from 'sentry/constants';
import {routes, routes6} from 'sentry/routes';
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

const sentryCreateBrowserRouter = wrapCreateBrowserRouter(createBrowserRouter);
const router = sentryCreateBrowserRouter(routes6);

if (window.__SENTRY_USING_REACT_ROUTER_SIX) {
  DANGEROUS_SET_REACT_ROUTER_6_HISTORY(router);
}

function Main() {
  return (
    <ThemeAndStyleProvider>
      <QueryClientProvider client={queryClient}>
        <OnboardingContextProvider>
          {ConfigStore.get('demoMode') && <DemoHeader />}
          {window.__SENTRY_USING_REACT_ROUTER_SIX ? (
            <RouterProvider router={router} />
          ) : (
            <Router history={browserHistory} render={renderRouter}>
              {routes()}
            </Router>
          )}
        </OnboardingContextProvider>
        {USE_REACT_QUERY_DEVTOOL && (
          <ReactQueryDevtools initialIsOpen={false} position="bottom-left" />
        )}
      </QueryClientProvider>
    </ThemeAndStyleProvider>
  );
}

export default Main;
