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

  bootApplication(data);
  preloadOrganizationData(data);

  return data;
}

function promiseRequest(url: string): Promise<any> {
  return new Promise(function (resolve, reject) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.setRequestHeader('sentry-trace', window.__initialData.initialTrace.sentry_trace);
    xhr.setRequestHeader('baggage', window.__initialData.initialTrace.baggage);
    xhr.withCredentials = true;
    xhr.onload = function () {
      try {
        this.status >= 200 && this.status < 300
          ? resolve([JSON.parse(xhr.response), this.statusText, xhr])
          : reject([this.status, this.statusText]);
      } catch (e) {
        reject();
      }
    };
    xhr.onerror = function () {
      reject([this.status, this.statusText]);
    };
    xhr.send();
  });
}

function preloadOrganizationData(config: Config) {
  if (!config.user) {
    // Don't send requests if there is no logged in user.
    return;
  }
  let slug = config.lastOrganization;
  if (!slug && config.customerDomain) {
    slug = config.customerDomain.subdomain;
  }

  let host = '';
  if (config.links?.regionUrl && config.links?.regionUrl !== config.links?.sentryUrl) {
    host = config.links.regionUrl;
  }
  // When running in 'dev-ui' mode we need to use /region/$region instead of
  // subdomains so that webpack/vercel can proxy requests.
  if (host && window.__SENTRY_DEV_UI) {
    const domainpattern = /https?\:\/\/([^.]*)\.sentry.io/;
    const domainmatch = host.match(domainpattern);
    if (domainmatch) {
      host = `/region/${domainmatch[1]}`;
    }
  }

  function makeUrl(suffix: string) {
    return host + '/api/0/organizations/' + slug + suffix;
  }

  const preloadPromises: Record<string, any> = {orgSlug: slug};
  window.__sentry_preload = preloadPromises;
  try {
    preloadPromises.organization = promiseRequest(makeUrl('/?detailed=0'));
    preloadPromises.projects = promiseRequest(
      makeUrl('/projects/?all_projects=1&collapse=latestDeploys')
    );
    preloadPromises.teams = promiseRequest(makeUrl('/teams/'));
  } catch (e) {
    // eslint-disable-next-line
    console.error(e);
  }
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
