import {browserHistory, Router, RouterContext} from 'react-router';

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
  console.log('renderRouter', props);
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
      <PersistedStoreProvider>
        {ConfigStore.get('demoMode') && <DemoHeader />}
        <Router history={browserHistory} render={renderRouter}>
          {routes()}
        </Router>
      </PersistedStoreProvider>
    </ThemeAndStyleProvider>
  );
}

export default Main;
