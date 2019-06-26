import '@babel/polyfill';

const BOOTSTRAP_URL = '/api/client-config/';

const bootApplication = data => {
  const {distPrefix, csrfCookieName, sentryConfig, userIdentity} = data;

  window.csrfCookieName = csrfCookieName;
  window.__sentryGlobalStaticPrefix = distPrefix;
  window.__SENTRY__OPTIONS = sentryConfig;
  window.__SENTRY__USER = userIdentity;
  window.__initialData = data;

  // Once data hydration is done we can initialize the app
  require('./bootstrap');
};

async function bootWithHydration() {
  const response = await fetch(BOOTSTRAP_URL);
  const data = await response.json();

  // TODO(epurkhiser): Currently we just serve everything from the root
  // directory, so there is no distPrefix.
  data.distPrefix = '/sentry/dist/';

  bootApplication(data);

  // TODO(epurkhiser): This should live somewhere else
  $(() => window.SentryRenderApp());
}

const bootstrapData = window.__initialData;

// If __initialData is not already set on the window, we are likely running in
// pure SPA mode, meaning django is not serving our frontend application and we
// need to make an API request to hydrate the bootstrap data to boot the app.
if (bootstrapData === undefined) {
  bootWithHydration();
} else {
  bootApplication(bootstrapData);
}
