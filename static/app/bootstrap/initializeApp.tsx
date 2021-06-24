import 'bootstrap/js/alert';
import 'bootstrap/js/tab';
import 'bootstrap/js/dropdown';
import './exportGlobals';

import routes from 'app/routes';
import {Config} from 'app/types';
import {metric} from 'app/utils/analytics';

import {commonInitialization} from './commonInitialization';
import {initializeSdk} from './initializeSdk';
import {processInitQueue} from './processInitQueue';
import {renderMain} from './renderMain';
import {renderOnDomReady} from './renderOnDomReady';

export async function initializeApp(config: Config) {
  commonInitialization(config);
  initializeSdk(config, {routes});

  // Used for operational metrics to determine that the application js
  // bundle was loaded by browser.
  metric.mark({name: 'sentry-app-init'});
  renderOnDomReady(renderMain);
  processInitQueue();
}
