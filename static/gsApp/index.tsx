import ConfigStore from 'sentry/stores/configStore';

async function gsApp() {
  try {
    const [{bootstrap}, {initializeLocale}] = await Promise.all([
      import('sentry/bootstrap'),
      import('sentry/bootstrap/initializeLocale'),
    ]);

    const data = await bootstrap();

    // This is called in `initializeMain` but we want to do this before `registerHooks` to
    // avoid some warnings.
    await initializeLocale(data);

    // We have split up the imports this way so that locale is initialized as
    // early as possible, (e.g. before `registerHooks` is imported otherwise the
    // imports in `registerHooks` will not be in the correct locale.
    const [{default: registerHooks}, {initializeBundleMetrics}, {initializeMain}] =
      await Promise.all([
        import('getsentry/registerHooks'),
        import('getsentry/initializeBundleMetrics'),
        import('sentry/bootstrap/initializeMain'),
      ]);

    // getsentry augments Sentry's application through a 'hook' mechanism. Sentry
    // provides various hooks into parts of its application. Thus all getsentry
    // functionality is initialized by registering its hook functions.
    registerHooks();

    await initializeMain(data);
    initializeBundleMetrics();
  } catch (err) {
    window.Sentry?.captureException(err);
    console.error(err); // eslint-disable-line no-console
  }
}

if (ConfigStore.get('sentryMode') === 'SAAS') {
  gsApp();
}
