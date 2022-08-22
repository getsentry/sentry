import 'focus-visible';

import {initializePipelineView} from 'sentry/bootstrap/initializePipelineView';

export function init() {
  initializePipelineView(window.__initialData);
}
