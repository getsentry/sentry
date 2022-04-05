import {browserHistory, Router} from 'react-router';

import DemoHeader from 'sentry/components/demo/demoHeader';
import ThemeAndStyleProvider from 'sentry/components/themeAndStyleProvider';
import routes from 'sentry/routes';
import LegacyConfigStore from 'sentry/stores/configStore';

import {ConfigProvider} from './stores/configStore/configProvider';

function Main() {
  return (
    <ConfigProvider initialValue={LegacyConfigStore.config} bridgeReflux>
      <ThemeAndStyleProvider>
        {LegacyConfigStore.get('demoMode') && <DemoHeader />}
        <Router history={browserHistory}>{routes()}</Router>
      </ThemeAndStyleProvider>
    </ConfigProvider>
  );
}

export default Main;
