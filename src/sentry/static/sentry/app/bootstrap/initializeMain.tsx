import 'bootstrap/js/alert';
import 'bootstrap/js/tab';
import 'bootstrap/js/dropdown';
import './commonInitialization';
import './exportGlobals';

import routes from 'app/routes';
import ConfigStore from 'app/stores/configStore';
import {metric} from 'app/utils/analytics';

import {initializeSdk} from './initializeSdk';
import {renderMain} from './renderMain';
import {renderOnDomReady} from './renderOnDomReady';

export function initializeMain() {
  const config = ConfigStore.getConfig();
  initializeSdk(config, {routes});

  // Used for operational metrics to determine that the application js
  // bundle was loaded by browser.
  metric.mark({name: 'sentry-app-init'});
  renderOnDomReady(renderMain);
}
