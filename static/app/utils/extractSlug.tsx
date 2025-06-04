type ExtractedSlug = {
  domain: string;
  slug: string;
};

// XXX: If you change this also change its sibiling in:
// - static/index.ejs
// - webpack.config.ts
const KNOWN_DOMAINS = /(?:\.?)((?:localhost|dev\.getsentry\.net|sentry\.dev)(?:\:\d*)?)$/;

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
