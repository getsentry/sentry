type ExtractedSlug = {
  domain: string;
  slug: string;
};

// XXX: If you change this also change its sibiling in static/index.ejs
const KNOWN_DOMAINS = /(?:localhost|dev\.getsentry.net|sentry.dev)(?:\:\d*)?$/;

/**
 * Extract a slug from a known local development host.
 * If the host is not a known development host null is returned.
 */
export function extractSlug(hostname: string): ExtractedSlug | null {
  const [slug, ...domainParts] = hostname.split('.');
  const domain = domainParts.join('.');
  if (!domain.match(KNOWN_DOMAINS)) {
    return null;
  }

  return {slug, domain};
}
