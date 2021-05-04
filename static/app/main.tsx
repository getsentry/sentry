import {browserHistory, Router} from 'react-router';

import DemoHeader from 'app/components/demo/demoHeader';
import routes from 'app/routes';
import ConfigStore from 'app/stores/configStore';

import ThemeAndStyleProvider from './themeAndStyleProvider';

export default function Main() {
  return (
    <ThemeAndStyleProvider>
      {ConfigStore.get('demoMode') && <DemoHeader />}
      <Router history={browserHistory}>{routes()}</Router>
    </ThemeAndStyleProvider>
  );
}
