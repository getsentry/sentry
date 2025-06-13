import type {Config} from 'sentry/types/system';
import {metric} from 'sentry/utils/analytics';

import {commonInitialization} from './commonInitialization';
import {initializeSdk} from './initializeSdk';
import {renderOnDomReady} from './renderOnDomReady';
import {renderPipelineView} from './renderPipelineView';

export function initializePipelineView(config: Config) {
  /**
   * XXX: Note we do not include routingInstrumentation because importing
   * `app/routes` significantly increases bundle size.
   *
   * A potential solution would be to use dynamic imports here to import
   * `app/routes` to pass to `initializeSdk()`
   */
  initializeSdk(config);

  // Initialize the config store after the SDK, so we can log errors to Sentry during config initialization if needed. N.B. This mutates the config slightly
  commonInitialization(config);

  // Used for operational metrics to determine that the application js
  // bundle was loaded by browser.
  metric.mark({name: 'sentry-pipeline-init'});
  renderOnDomReady(renderPipelineView);
}
