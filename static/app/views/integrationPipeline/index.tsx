async function integrationPipeline() {
  const {init} = await import('./init');
  init();
}

integrationPipeline();
