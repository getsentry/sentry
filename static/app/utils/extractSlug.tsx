import {DEPLOY_PREVIEW_CONFIG} from 'sentry/constants';

type ExtractedSlug = {
  domain: string;
  slug: string;
};

// XXX: If you change this also change its sibiling in:
// - static/index.ejs
// - rsbuild.config.ts
const KNOWN_DOMAINS = /\.?((?:localhost|dev\.getsentry\.net|sentry\.dev)(?::\d*)?)$/;

/**
 * Extract a slug from a known local development host.
 * If the host is not a known development host null is returned.
 */
export function extractSlug(hostname: string): ExtractedSlug | null {
  const match = hostname.match(KNOWN_DOMAINS);
  if (!match) {
    return null;
  }

  const [
    matchedExpression, // Expression includes optional leading `.`
    matchedDomain, // First match group never includes optional leading `.`
  ] = match;

  const [slug, ...domainParts] = hostname.replace(matchedExpression, '').split('.');
  const domain = domainParts.concat(matchedDomain!).join('.');

  return {slug: slug!, domain};
}

/**
 * Organization slug from the current dev-ui organization domain, such as
 * `acme.dev.getsentry.net`. Returns null outside dev-ui and on deploy
 * previews: previews are served from a single deployment host such as
 * `sentry-abc123.sentry.dev`, so its first label is not an organization.
 */
export function getDevUiOrganizationSlug(): string | null {
  if (!window.__SENTRY_DEV_UI || DEPLOY_PREVIEW_CONFIG) {
    return null;
  }

  return extractSlug(window.location.host)?.slug || null;
}
