/**
 * Check if we a request is going to the same or similar origin.
 * similar origins are those that share an ancestor. Example `sentry.sentry.io` and `us.sentry.io`
 * are similar origins, but sentry.sentry.io and sentry.example.io are not.
 */
export function isSimilarOrigin(target: string, origin: string): boolean {
  const targetUrl = new URL(target, origin);
  const originUrl = new URL(origin);
  // If the hosts are the same, or one of the domains is a child of the other.
  if (
    isSameOrSubdomain(originUrl.hostname, targetUrl.hostname) ||
    isSameOrSubdomain(targetUrl.hostname, originUrl.hostname)
  ) {
    return true;
  }
  // Check if the target and origin are on sibiling subdomains.
  const targetHost = targetUrl.hostname.split('.');
  const originHost = originUrl.hostname.split('.');

  // Remove the subdomains. If don't have at least 2 segments we aren't subdomains.
  targetHost.shift();
  originHost.shift();
  if (targetHost.length < 2 || originHost.length < 2) {
    return false;
  }
  return targetHost.join('.') === originHost.join('.');
}

/**
 * Compare whole DNS labels, so `sentry.io` matches `us.sentry.io` but not
 * `notsentry.io`.
 */
function isSameOrSubdomain(hostname: string, parent: string): boolean {
  return hostname === parent || hostname.endsWith(`.${parent}`);
}
