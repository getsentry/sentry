import {browserHistory, Router, RouterContext} from 'react-router';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import DemoHeader from 'sentry/components/demo/demoHeader';
import ThemeAndStyleProvider from 'sentry/components/themeAndStyleProvider';
import {routes} from 'sentry/routes';
import ConfigStore from 'sentry/stores/configStore';
import {PersistedStoreProvider} from 'sentry/stores/persistedStore';
import {RouteContext} from 'sentry/views/routeContext';

import RouteAnalyticsContextProvider from './views/routeAnalyticsContextProvider';
/**
 * Renders our compatability RouteContext.Provider. This will go away with
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

const queryClient = new QueryClient();

function Main() {
  return (
    <ThemeAndStyleProvider>
      <QueryClientProvider client={queryClient}>
        <PersistedStoreProvider>
          {ConfigStore.get('demoMode') && <DemoHeader />}
          <Router history={browserHistory} render={renderRouter}>
            {routes()}
          </Router>
        </PersistedStoreProvider>
      </QueryClientProvider>
    </ThemeAndStyleProvider>
  );
}

export default Main;
