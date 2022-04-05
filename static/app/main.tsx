import {browserHistory, Router} from 'react-router';

import DemoHeader from 'sentry/components/demo/demoHeader';
import ThemeAndStyleProvider from 'sentry/components/themeAndStyleProvider';
import routes from 'sentry/routes';
import ConfigStore from 'sentry/stores/configStore';

import {CommittersProvider} from './stores/commiters/committersProvider';

function Main() {
  return (
    <ThemeAndStyleProvider>
      {ConfigStore.get('demoMode') && <DemoHeader />}
      <Router history={browserHistory}>
        <CommittersProvider>{routes()}</CommittersProvider>
      </Router>
    </ThemeAndStyleProvider>
  );
}

export default Main;
