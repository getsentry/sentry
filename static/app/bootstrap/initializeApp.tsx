import './legacyTwitterBootstrap';
import './exportGlobals';

import type {Config} from 'sentry/types/system';
import {metric} from 'sentry/utils/analytics';

import {commonInitialization} from './commonInitialization';
import {initializeSdk} from './initializeSdk';
import {processInitQueue} from './processInitQueue';
import {renderMain} from './renderMain';
import {renderOnDomReady} from './renderOnDomReady';

export function initializeApp(config: Config) {
  initializeSdk(config);
  // Initialize the config store after the SDK, so we can log errors to Sentry during config initialization if needed. N.B. This mutates the config slightly
  commonInitialization(config);

  // Used for operational metrics to determine that the application js
  // bundle was loaded by browser.
  metric.mark({name: 'sentry-app-init'});
  renderOnDomReady(renderMain);
  processInitQueue();
}
