async function integrationPipeline() {
  const {init} =  await import(/* webpackChunkName: "integrationPipelineInit" */ './init');
  init();
}

integrationPipeline();
