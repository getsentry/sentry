type ExtractedSlug = {
  domain: string;
  /**
   * What sits between the slug and the domain. A subdomain on a host that can
   * take one, `---` on a host that has to stay a single DNS label.
   */
  separator: '.' | '---';
  slug: string;
};

// XXX: If you change this also change its sibling in:
// - rspack.config.ts
const KNOWN_DOMAINS = /\.?((?:localhost|dev\.getsentry\.net|sentry\.dev)(?::\d*)?)$/;

/**
 * Separator for hosts that cannot spend a DNS label on the organization.
 *
 * A wildcard certificate covers exactly one label, so neither a Coder workspace
 * app (`*.coder.sentry.dev`) nor a Vercel multi-tenant preview URL can put the
 * organization in a subdomain of its own. Both platforms solve it the same way,
 * by prefixing the single label they do own:
 *
 *   acme---dev-ui--workspace--owner.coder.sentry.dev
 *   acme---sentry-git-my-branch.sentry.dev
 */
const PREFIX_SEPARATOR = '---';

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

  const [firstLabel, ...domainParts] = hostname.replace(matchedExpression, '').split('.');

  // `acme---rest-of-the-label`: the organization is the prefix, everything from
  // the separator on belongs to the host we were served from.
  const prefixIndex = firstLabel!.indexOf(PREFIX_SEPARATOR);
  if (prefixIndex !== -1) {
    const remainder = firstLabel!.slice(prefixIndex + PREFIX_SEPARATOR.length);
    return {
      slug: firstLabel!.slice(0, prefixIndex),
      domain: [remainder, ...domainParts, matchedDomain!].join('.'),
      separator: PREFIX_SEPARATOR,
    };
  }

  // Without a prefix, a proxy's hostname is entirely its own -- `dev-ui--ws--owner`
  // is the tunnel's name for itself, not an organization we can route to.
  if (window.__SENTRY_DEV_UI_PROXY_HOST) {
    return null;
  }

  return {
    slug: firstLabel!,
    domain: domainParts.concat(matchedDomain!).join('.'),
    separator: '.',
  };
}
