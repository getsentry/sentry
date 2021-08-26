async function app() {
  const [{bootstrap}, {initializeMain}] = await Promise.all([
    import('app/bootstrap'),
    import('app/bootstrap/initializeMain'),
  ]);
  const data = await bootstrap();
  initializeMain(data);
}

app();
