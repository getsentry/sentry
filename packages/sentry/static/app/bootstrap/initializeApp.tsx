import './legacyTwitterBootstrap';
import './exportGlobals';

import {routes} from 'sentry/routes';
import {Config} from 'sentry/types';
import {metric} from 'sentry/utils/analytics';

import {commonInitialization} from './commonInitialization';
import {initializeSdk} from './initializeSdk';
import {processInitQueue} from './processInitQueue';
import {renderMain} from './renderMain';
import {renderOnDomReady} from './renderOnDomReady';

export function initializeApp(config: Config) {
  commonInitialization(config);
  initializeSdk(config, {routes});

  // Used for operational metrics to determine that the application js
  // bundle was loaded by browser.
  metric.mark({name: 'sentry-app-init'});
  renderOnDomReady(renderMain);
  processInitQueue();
}
