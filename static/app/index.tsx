import {Config} from 'app/types';

const BOOTSTRAP_URL = '/api/client-config/';

const bootApplication = (data: Config) => {
  window.csrfCookieName = data.csrfCookieName;

  // Once data hydration is done we can initialize the app
  const {initializeMain} = require('./bootstrap/initializeMain');
  initializeMain(data);
};

async function bootWithHydration() {
  const response = await fetch(BOOTSTRAP_URL);
  const data: Config = await response.json();

  window.__initialData = data;

  bootApplication(data);
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
