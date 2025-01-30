import './legacyTwitterBootstrap';
import './exportGlobals';

import {localStoragePersister} from 'sentry/appQueryClient';
import type {Config} from 'sentry/types/system';
import {metric} from 'sentry/utils/analytics';

import {commonInitialization} from './commonInitialization';
import {initializeSdk} from './initializeSdk';
import {processInitQueue} from './processInitQueue';
import {renderMain} from './renderMain';
import {renderOnDomReady} from './renderOnDomReady';

export function initializeApp(config: Config) {
  // We might need to call restoreClient earlier or await the promise to ensure
  // the client is hydrated before the app is rendered
  localStoragePersister.restoreClient();
  commonInitialization(config);
  initializeSdk(config);

  // Used for operational metrics to determine that the application js
  // bundle was loaded by browser.
  metric.mark({name: 'sentry-app-init'});
  renderOnDomReady(renderMain);
  processInitQueue();
}
