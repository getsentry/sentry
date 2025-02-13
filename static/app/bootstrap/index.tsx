import type {ResponseMeta} from 'sentry/api';
import {EXPERIMENTAL_SPA} from 'sentry/constants';
import type {Config} from 'sentry/types/system';
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

async function promiseRequest(url: string) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json; charset=utf-8',
        'Content-Type': 'application/json',
        'sentry-trace': window.__initialData.initialTrace.sentry_trace,
        baggage: window.__initialData.initialTrace.baggage,
      },
      credentials: 'include',
      priority: 'high',
    });
    if (response.status >= 200 && response.status < 300) {
      const text = await response.text();
      const json = JSON.parse(text);
      const responseMeta: ResponseMeta = {
        status: response.status,
        statusText: response.statusText,
        responseJSON: json,
        responseText: text,
        getResponseHeader: (header: string) => response.headers.get(header),
      };
      return [json, response.statusText, responseMeta];
    }
    // eslint-disable-next-line no-throw-literal
    throw [response.status, response.statusText];
  } catch (error) {
    // eslint-disable-next-line no-throw-literal
    throw [error.status, error.statusText];
  }
}

function preloadOrganizationData(config: Config) {
  if (!config.shouldPreloadData || EXPERIMENTAL_SPA) {
    // Don't send requests if we're not supposed to preload data.
    // See https://github.com/getsentry/sentry/blob/760afb3ab9d2bed669df2f2a01e58c438ceafa3c/src/sentry/web/client_config.py#L394-L418
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
    if (!slug) {
      return;
    }
    preloadPromises.organization = promiseRequest(
      makeUrl('/?detailed=0&include_feature_flags=1')
    );
    preloadPromises.projects = promiseRequest(
      makeUrl('/projects/?all_projects=1&collapse=latestDeploys&collapse=unusedFeatures')
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
