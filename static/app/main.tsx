import {browserHistory, Router} from 'react-router';

import DemoHeader from 'sentry/components/demo/demoHeader';
import ThemeAndStyleProvider from 'sentry/components/themeAndStyleProvider';
import routes from 'sentry/routes';
import LegacyConfigStore from 'sentry/stores/configStore';

import {ConfigProvider} from './stores/configStore/configProvider';
import {useConfig} from './stores/configStore/useConfig';
import Button from 'sentry/components/button';
import {useLegacyStore} from './stores/useLegacyStore';

const ReactContext = () => {
  const [config, dispatch] = useConfig();

  return (
    <span>
      React Theme: {config.theme}{' '}
      <Button
        onClick={() =>
          dispatch({
            type: 'set theme',
            payload: config.theme === 'dark' ? 'light' : 'dark',
          })
        }
      >
        Switch to {config.theme === 'dark' ? 'light' : 'dark'}
      </Button>
    </span>
  );
};

const LegacyContext = () => {
  const store = useLegacyStore(LegacyConfigStore);

  return (
    <span>
      Reflux Theme: {store.theme}{' '}
      <Button
        onClick={() =>
          LegacyConfigStore.set('theme', store.theme === 'dark' ? 'light' : 'dark')
        }
      >
        Switch to {store.theme === 'dark' ? 'light' : 'dark'}
      </Button>
    </span>
  );
};

function Main() {
  return (
    <ConfigProvider initialValue={LegacyConfigStore.config}>
      <ThemeAndStyleProvider>
        <ReactContext />
        <LegacyContext />
        {LegacyConfigStore.get('demoMode') && <DemoHeader />}
        <Router history={browserHistory}>{routes()}</Router>
      </ThemeAndStyleProvider>
    </ConfigProvider>
  );
}

export default Main;
