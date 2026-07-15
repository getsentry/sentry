import {controlsiloUrlPatterns} from 'sentry/data/controlsiloUrlPatterns';
import {getClientConfigFromCache} from 'sentry/serviceWorker/worker/client-config';
import {type ClientConfig} from 'sentry/serviceWorker/worker/client-config';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';

type ApiUrl = ReturnType<typeof getApiUrl>;

const sw = self as unknown as ServiceWorkerGlobalScope;

export async function workerFetch(
  apiUrl: ApiUrl,
  query: Record<string, string>
): Promise<Response> {
  const config = await getClientConfigFromCache();
  const [host, prefix] = resolveHost(config, apiUrl);
  const url = new URL(prefix + '/api/0' + apiUrl, host);
  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url, {
    credentials: 'include',
    headers: {'Content-Type': 'application/json'},
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response;
}

function resolveHost(config: ClientConfig, path: ApiUrl): [string, string] {
  const {links: configLinks, features: systemFeatures} = config;

  // We're on a domain that is not the organization's domain, probably via a
  // proxy, in dev or vercel-preview.
  const isDev = config.customerDomain?.organizationUrl !== sw.location.origin;

  if (isDev) {
    // When running as pnpm dev-ui we can't spread requests across domains because
    // of CORS. Instead we extract the subdomain from the hostname
    // and prepend the URL with `/region/$name` so that webpack-devserver proxy
    // can route requests to the regions.
    const domainpattern = /https?:\/\/([^.]*)\.sentry\.io/;
    const domainmatch = configLinks.regionUrl.match(domainpattern);
    if (domainmatch) {
      return [sw.location.origin, `/region/${domainmatch[1]}`];
    }
  }

  if (systemFeatures.includes('system:multi-region')) {
    // We're in a multi-region env, we'll either use the control silo, or the
    // region URL.
    // Fallback to use the current hostname if the config is not set.
    return isControlSiloPath(path)
      ? [configLinks.sentryUrl, '']
      : [configLinks.regionUrl, ''];
  }

  // Not multi-region, we can only call against the current hostname.
  return [sw.location.origin, ''];
}

function isControlSiloPath(apiUrl: ApiUrl): boolean {
  const path = apiUrl.slice(1);
  for (const pattern of controlsiloUrlPatterns) {
    if (pattern.test(path)) {
      return true;
    }
  }
  return false;
}
