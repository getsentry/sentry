import {Router, RouterContext} from 'react-router';
import {ReactQueryDevtools} from '@tanstack/react-query-devtools';

import DemoHeader from 'sentry/components/demo/demoHeader';
import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {routes} from 'sentry/routes';
import ConfigStore from 'sentry/stores/configStore';
import {browserHistory} from 'sentry/utils/browserHistory';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {RouteContext} from 'sentry/views/routeContext';

import RouteAnalyticsContextProvider from './views/routeAnalyticsContextProvider';
import {queryClient} from './queryClient';

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
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      </QueryClientProvider>
    </ThemeAndStyleProvider>
  );
}

export default Main;
