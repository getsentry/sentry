import {render} from 'react-dom';

import {ROOT_ELEMENT} from 'sentry/constants';
import {PipelineInitialData} from 'sentry/types';
import PipelineView from 'sentry/views/integrationPipeline/pipelineView';

function renderDom(pipelineName: string, props: PipelineInitialData['props']) {
  const rootEl = document.getElementById(ROOT_ELEMENT);
  render(<PipelineView pipelineName={pipelineName} {...props} />, rootEl);
}

export function renderPipelineView() {
  const {name, props} = window.__pipelineInitialData;
  renderDom(name, props);
}
