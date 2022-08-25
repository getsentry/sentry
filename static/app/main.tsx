import {browserHistory, Router, RouterContext} from 'react-router';
import {Configuration, OpenAIApi} from 'openai';

import DemoHeader from 'sentry/components/demo/demoHeader';
import ThemeAndStyleProvider from 'sentry/components/themeAndStyleProvider';
import {routes} from 'sentry/routes';
import ConfigStore from 'sentry/stores/configStore';
import {RouteContext} from 'sentry/views/routeContext';

// create a new file @ './icons/clippy/keys.ts' and add your API and ORG keys
import {API_KEY, ORG_ID} from './icons/clippy/keys.example';
import {PersistedStoreProvider} from './stores/persistedStore';

const configuration = new Configuration({organization: ORG_ID, apiKey: API_KEY});
export const openai = new OpenAIApi(configuration);

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
