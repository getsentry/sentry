import {browserHistory, Router, RouterContext} from 'react-router';

import DemoHeader from 'sentry/components/demo/demoHeader';
import ThemeAndStyleProvider from 'sentry/components/themeAndStyleProvider';
import {routes} from 'sentry/routes';
import ConfigStore from 'sentry/stores/configStore';
import {RouteContext} from 'sentry/views/routeContext';

import {PersistedStoreProvider} from './stores/persistedStore';

function Main() {
  return (
    <ThemeAndStyleProvider>
      <PersistedStoreProvider>
        {ConfigStore.get('demoMode') && <DemoHeader />}
        <Router
          history={browserHistory}
          render={props => (
            <RouteContext.Provider value={props}>
              <RouterContext {...props} />
            </RouteContext.Provider>
          )}
        >
          {routes()}
        </Router>
      </PersistedStoreProvider>
    </ThemeAndStyleProvider>
  );
}

export default Main;
