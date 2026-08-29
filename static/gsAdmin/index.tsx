// Polyfills for ES2023+ methods not available in older browsers (e.g. Chrome < 110).
import 'sentry/utils/toSortedPolyfill';

async function gsAdmin() {
  const [{bootstrap}, {initializeLocale}] = await Promise.all([
    import('sentry/bootstrap'),
    import('sentry/bootstrap/initializeLocale'),
  ]);

  const config = await bootstrap();
  await initializeLocale(config);

  // We have split up the imports this way so that locale is initialized as
  // early as possible, (e.g. before `registerOverrides` is imported otherwise the
  // imports in `registerOverrides` will not be in the correct locale.
  const {init, renderApp} = await import('./init');

  init(config);
  renderApp();
}

gsAdmin();
