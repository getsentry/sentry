// These imports (core-js and regenerator-runtime) are replacements for deprecated `@babel/polyfill`
import 'core-js/stable';
import 'regenerator-runtime/runtime';

import {Config} from 'app/types';

const BOOTSTRAP_URL = '/api/client-config/';

const bootApplication = (data: Config) => {
  const {distPrefix, csrfCookieName, sentryConfig, userIdentity} = data;

  // TODO(epurkhiser): Would be great if we could remove some of these from
  // existing on the window object and instead pass into a bootstrap function.
  // We can't currently do this due to some of these globals needing to be
  // available for modules imported by the bootstrap.
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
  const data: Config = await response.json();

  // XXX(epurkhiser): Currently we only boot with hydration in experimental SPA
  // mode, where assets are *currently not versioned*. We hardcode this here
  // for now as a quick workaround for the index.html being aware of versioned
  // asset paths.
  data.distPrefix = '/_assets/';

  bootApplication(data);

  // TODO(epurkhiser): This should live somewhere else
  $(window.SentryRenderApp);
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
