import {browserHistory, Router, RouterContext} from 'react-router';

import DemoHeader from 'sentry/components/demo/demoHeader';
import ThemeAndStyleProvider from 'sentry/components/themeAndStyleProvider';
import routes from 'sentry/routes';
import ConfigStore from 'sentry/stores/configStore';
import {RouteContext} from 'sentry/views/routeContext';

function Main() {
  return (
    <ThemeAndStyleProvider>
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
    </ThemeAndStyleProvider>
  );
}

export default Main;
