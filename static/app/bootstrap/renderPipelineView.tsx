import ReactDOM from 'react-dom';

import {ROOT_ELEMENT} from 'app/constants';
import {PipelineInitialData} from 'app/types';
import PipelineView from 'app/views/integrationPipeline/pipelineView';

function render(pipelineName: string, props: PipelineInitialData['props']) {
  const rootEl = document.getElementById(ROOT_ELEMENT);
  ReactDOM.render(<PipelineView pipelineName={pipelineName} {...props} />, rootEl);
}

export function renderPipelineView() {
  const {name, props} = window.__pipelineInitialData;
  render(name, props);
}
