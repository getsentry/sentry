import {Router, RouterContext} from 'react-router';
import {ReactQueryDevtools} from '@tanstack/react-query-devtools';

import DemoHeader from 'sentry/components/demo/demoHeader';
import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {USE_REACT_QUERY_DEVTOOL} from 'sentry/constants';
import {routes} from 'sentry/routes';
import ConfigStore from 'sentry/stores/configStore';
import {browserHistory} from 'sentry/utils/browserHistory';
import {
  DEFAULT_QUERY_CLIENT_CONFIG,
  QueryClient,
  QueryClientProvider,
} from 'sentry/utils/queryClient';
import {RouteContext} from 'sentry/views/routeContext';

import RouteAnalyticsContextProvider from './views/routeAnalyticsContextProvider';
/**
 * Renders our compatibility RouteContext.Provider. This will go away with
 * react-router v6.
 */
function renderRouter(props: any) {
  return (
    <RouteAnalyticsContextProvider {...props}>
      <RouteContext.Provider value={props}>
        <RouterContext {...props} />
      </RouteContext.Provider>
    </RouteAnalyticsContextProvider>
  );
}

const queryClient = new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG);

function Main() {
  return (
    <ThemeAndStyleProvider>
      <QueryClientProvider client={queryClient}>
        <OnboardingContextProvider>
          {ConfigStore.get('demoMode') && <DemoHeader />}
          <Router history={browserHistory} render={renderRouter}>
            {routes()}
          </Router>
        </OnboardingContextProvider>
        {USE_REACT_QUERY_DEVTOOL && (
          <ReactQueryDevtools initialIsOpen={false} position="bottom-left" />
        )}
      </QueryClientProvider>
    </ThemeAndStyleProvider>
  );
}

export default Main;
