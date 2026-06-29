import {controlsiloUrlPatterns} from 'sentry/data/controlsiloUrlPatterns';
import {ConfigStore} from 'sentry/stores/configStore';

export function resolveHostname(path: string, hostname?: string): string {
  const configLinks = ConfigStore.get('links');
  const systemFeatures = ConfigStore.get('features');

  hostname = hostname ?? '';
  if (!hostname && systemFeatures.has('system:multi-region')) {
    // /_admin/ is special: since it doesn't update OrganizationStore, it's
    // commonly the case that requests will be made for data which does not
    // exist in the same region as the one in configLinks.regionUrl. Because of
    // this we want to explicitly default those requests to be proxied through
    // the control silo which can handle region resolution in exchange for a
    // bit of latency.
    const isAdmin = window.location.pathname.startsWith('/_admin/');
    const isControlSilo = detectControlSiloPath(path);
    if (!isAdmin && !isControlSilo && configLinks.regionUrl) {
      hostname = configLinks.regionUrl;
    }
    if (isControlSilo && configLinks.sentryUrl) {
      hostname = configLinks.sentryUrl;
    }
  }

  // If we're making a request to the applications' root
  // domain, we can drop the domain as webpack devserver will add one.
  // TODO(hybridcloud) This can likely be removed when sentry.types.cell.Region.to_url()
  // loses the monolith mode condition.
  if (window.__SENTRY_DEV_UI && hostname === configLinks.sentryUrl) {
    hostname = '';
  }

  // When running as pnpm dev-ui we can't spread requests across domains because
  // of CORS. Instead we extract the subdomain from the hostname
  // and prepend the URL with `/region/$name` so that webpack-devserver proxy
  // can route requests to the regions.
  if (hostname && window.__SENTRY_DEV_UI) {
    const domainpattern = /https?:\/\/([^.]*)\.sentry\.io/;
    const domainmatch = hostname.match(domainpattern);
    if (domainmatch) {
      hostname = '';
      path = `/region/${domainmatch[1]}${path}`;
    }
  }
  if (hostname) {
    path = `${hostname}${path}`;
  }

  return path;
}

function detectControlSiloPath(path: string): boolean {
  // We sometimes include querystrings in paths.
  // Using URL() to avoid handrolling URL parsing
  const url = new URL(path, 'https://sentry.io');
  path = url.pathname;
  path = path.startsWith('/') ? path.substring(1) : path;
  for (const pattern of controlsiloUrlPatterns) {
    if (pattern.test(path)) {
      return true;
    }
  }
  return false;
}
