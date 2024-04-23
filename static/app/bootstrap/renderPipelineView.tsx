import {render} from 'react-dom';
import {createRoot} from 'react-dom/client';

import {ROOT_ELEMENT, USE_REACT_CONCURRENT_MODE} from 'sentry/constants';
import type {PipelineInitialData} from 'sentry/types/system';
import PipelineView from 'sentry/views/integrationPipeline/pipelineView';

function renderDom(pipelineName: string, props: PipelineInitialData['props']) {
  const rootEl = document.getElementById(ROOT_ELEMENT)!;

  // Types are for ConfigStore, the window object is from json and features is not a Set
  if (
    (window.__initialData.features as unknown as string[]).includes(
      'organizations:react-concurrent-renderer-enabled'
    ) ||
    USE_REACT_CONCURRENT_MODE
  ) {
    // Enable concurrent rendering
    const root = createRoot(rootEl);
    root.render(<PipelineView pipelineName={pipelineName} {...props} />);
  } else {
    // Legacy rendering
    render(<PipelineView pipelineName={pipelineName} {...props} />, rootEl);
  }
}

export function renderPipelineView() {
  const {name, props} = window.__pipelineInitialData;
  renderDom(name, props);
}
