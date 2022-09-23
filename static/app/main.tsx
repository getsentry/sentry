import {browserHistory, Router, RouterContext} from 'react-router';

import DemoHeader from 'sentry/components/demo/demoHeader';
import ThemeAndStyleProvider from 'sentry/components/themeAndStyleProvider';
import {routes} from 'sentry/routes';
import ConfigStore from 'sentry/stores/configStore';
import {RouteContext} from 'sentry/views/routeContext';

import {PersistedStoreProvider} from './stores/persistedStore';

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
