import {browserHistory, Router} from 'react-router';

import DemoHeader from 'sentry/components/demo/demoHeader';
import ThemeAndStyleProvider from 'sentry/components/themeAndStyleProvider';
import routes from 'sentry/routes';
import ConfigStore from 'sentry/stores/configStore';

import {PersistedStoreProvider} from './stores/persistedStore';

function Main() {
  return (
    <ThemeAndStyleProvider>
      <PersistedStoreProvider>
        {ConfigStore.get('demoMode') && <DemoHeader />}
        <Router history={browserHistory}>{routes()}</Router>
      </PersistedStoreProvider>
    </ThemeAndStyleProvider>
  );
}

export default Main;
