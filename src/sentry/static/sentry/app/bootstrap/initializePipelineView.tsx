import ConfigStore from 'app/stores/configStore';
import {metric} from 'app/utils/analytics';

import {initializeSdk} from './initializeSdk';
import {renderOnDomReady} from './renderOnDomReady';
import {renderPipelineView} from './renderPipelineView';

export function initializePipelineView() {
  // SDK INIT  --------------------------------------------------------
  const config = ConfigStore.getConfig();
  /**
   * XXX: Note we do not include routingInstrumentation because importing
   * `app/routes` significantly increases bundle size.
   *
   * A potential solution would be to use dynamic imports here to import
   * `app/routes` to pass to `initializeSdk()`
   */
  initializeSdk(config);

  // Used for operational metrics to determine that the application js
  // bundle was loaded by browser.
  metric.mark({name: 'sentry-pipeline-init'});
  renderOnDomReady(renderPipelineView);
}
