import {browserHistory, Router} from 'react-router';

import DemoHeader from 'app/components/demo/demoHeader';
import ThemeAndStyleProvider from 'app/components/themeAndStyleProvider';
import routes from 'app/routes';
import ConfigStore from 'app/stores/configStore';

function Main() {
  return (
    <ThemeAndStyleProvider>
      {ConfigStore.get('demoMode') && <DemoHeader />}
      <Router history={browserHistory}>{routes()}</Router>
    </ThemeAndStyleProvider>
  );
}

export default Main;
