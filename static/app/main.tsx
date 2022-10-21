import {browserHistory, Router, RouterContext} from 'react-router';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import DemoHeader from 'sentry/components/demo/demoHeader';
import ThemeAndStyleProvider from 'sentry/components/themeAndStyleProvider';
import {routes} from 'sentry/routes';
import ConfigStore from 'sentry/stores/configStore';
import {PersistedStoreProvider} from 'sentry/stores/persistedStore';
import {RouteContext} from 'sentry/views/routeContext';

/**
 * Renders our compatability RouteContext.Provider. This will go away with
 * react-router v6.
 */
function renderRouter(props: any) {
  return (
    <RouteContext.Provider value={props}>
      <RouterContext {...props} />
    </RouteContext.Provider>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Prevents queries from being refetched if the data is < 20 seconds old
      staleTime: 20_000,
    },
  },
});

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
