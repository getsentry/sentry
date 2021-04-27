async function integrationPipeline() {
  return await import(/* webpackChunkName: "integrationPipelineInit" */ './init');
}

integrationPipeline();
