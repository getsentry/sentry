/**
 * Takes a full URL used by the uptime detector and formats it nicely for display purposes
 *
 * https://example.com/health/check/ -> example.com/health/check
 */
export function formatUptimeUrl(url: string): string | null {
  const parsedUrl = URL.parse(url);
  if (!parsedUrl?.hostname) {
    return null;
  }

  const path = parsedUrl.pathname === '/' ? '' : parsedUrl.pathname;

  return `${parsedUrl.hostname}${path}`.replace(/\/$/, '');
}
