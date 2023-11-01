import {Config} from 'sentry/types';
import {extractSlug} from 'sentry/utils/extractSlug';

const BOOTSTRAP_URL = '/api/client-config/';

const bootApplication = (data: Config) => {
  window.csrfCookieName = data.csrfCookieName;
  window.superUserCookieName = data.superUserCookieName;
  window.superUserCookieDomain = data.superUserCookieDomain ?? undefined;

  return data;
};

/**
 * Load the client configuration data using the BOOTSTRAP_URL. Used when
 * running in standalone SPA mode.
 */
async function bootWithHydration() {
  const response = await fetch(BOOTSTRAP_URL);
  const data: Config = await response.json();

  // Shim up the initialData payload to quack like it came from
  // a customer-domains initial request. Because our initial call to BOOTSTRAP_URL
  // will not be on a customer domain, the response will not include this context.
  if (data.customerDomain === null && window.__SENTRY_DEV_UI) {
    const domain = extractSlug(window.location.host);
    if (domain) {
      data.customerDomain = {
        organizationUrl: `https://${domain.slug}.sentry.io`,
        sentryUrl: 'https://sentry.io',
        subdomain: domain.slug,
      };
    }
  }
  window.__initialData = data;

  return bootApplication(data);
}

/**
 * Load client configuration bootstrap data. This will detect if the app is
 * running in SPA mode or being booted from the django-rendered layout.html
 * template.
 */
export async function bootstrap() {
  const bootstrapData = window.__initialData;

  // If __initialData is not already set on the window, we are likely running in
  // pure SPA mode, meaning django is not serving our frontend application and we
  // need to make an API request to hydrate the bootstrap data to boot the app.
  if (bootstrapData === undefined) {
    return await bootWithHydration();
  }

  return bootApplication(bootstrapData);
}
