import '@babel/polyfill';

// Initial data hydration. The __initialData will be set by the django backend
// serving sentry.
if (window.__initialData) {
  const {distPrefix, csrfCookieName, sentryConfig, userIdentity} = window.__initialData;

  window.csrfCookieName = csrfCookieName;
  window.__sentryGlobalStaticPrefix = distPrefix;
  window.__SENTRY__OPTIONS = sentryConfig;
  window.__SENTRY__USER = userIdentity;
}

// Once data hydration is done we can initialize the app
require('app/bootstrap');
