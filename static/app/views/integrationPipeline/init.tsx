import 'focus-visible';

import {initializePipelineView} from 'app/bootstrap/initializePipelineView';

export function init() {
  initializePipelineView(window.__initialData);
}
