import './legacyTwitterBootstrap';
import './exportGlobals';

import {EXPERIMENTAL_SPA, NODE_ENV} from 'sentry/constants';
import routes from 'sentry/routes';
import {Config} from 'sentry/types';
import {metric} from 'sentry/utils/analytics';

import {commonInitialization} from './commonInitialization';
import {initializeSdk} from './initializeSdk';
import {processInitQueue} from './processInitQueue';
import {renderMain} from './renderMain';
import {renderOnDomReady} from './renderOnDomReady';

export async function initializeApp(config: Config) {
  commonInitialization(config);

  if (!EXPERIMENTAL_SPA && NODE_ENV !== 'development') {
    initializeSdk(config, {routes});
  }

  // Used for operational metrics to determine that the application js
  // bundle was loaded by browser.
  metric.mark({name: 'sentry-app-init'});
  renderOnDomReady(renderMain);
  processInitQueue();
}
