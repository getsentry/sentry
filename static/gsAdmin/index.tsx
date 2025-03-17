async function gsAdmin() {
  const [{bootstrap}, {initializeLocale}] = await Promise.all([
    import('sentry/bootstrap'),
    import('sentry/bootstrap/initializeLocale'),
  ]);

  const config = await bootstrap();
  await initializeLocale(config);

  // We have split up the imports this way so that locale is initialized as
  // early as possible, (e.g. before `registerHooks` is imported otherwise the
  // imports in `registerHooks` will not be in the correct locale.
  const {init, renderApp} = await import('./init');

  init(config);
  renderApp();
}

gsAdmin();
