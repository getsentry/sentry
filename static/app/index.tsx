async function app() {
  const [{bootstrap}, {initializeMain}] = await Promise.all([
    import(/* webpackChunkName: "appBootstrap" */ 'app/bootstrap'),
    import(
      /* webpackChunkName: "appBootstrapInitializeMain" */ 'app/bootstrap/initializeMain'
    ),
  ]);
  const data = await bootstrap();
  initializeMain(data);
}

app();
