import {createRoot} from 'react-dom/client';

import type {PipelineInitialData} from 'sentry/types/system';

import {ROOT_ELEMENT} from 'sentry/constants';
import PipelineView from 'sentry/views/integrationPipeline/pipelineView';

function renderDom(pipelineName: string, props: PipelineInitialData['props']) {
  const rootEl = document.getElementById(ROOT_ELEMENT)!;

  const root = createRoot(rootEl);
  root.render(<PipelineView pipelineName={pipelineName} {...props} />);
}

export function renderPipelineView() {
  const {name, props} = window.__pipelineInitialData;
  renderDom(name, props);
}
