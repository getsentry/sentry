import {patterns} from './controlsiloUrlPatterns';

export function isControlSiloPath(path: string): boolean {
  // We sometimes include querystrings in paths.
  // Using URL() to avoid handrolling URL parsing
  const url = new URL(path, 'https://sentry.io');
  path = url.pathname;
  path = path.startsWith('/') ? path.substring(1) : path;
  for (const pattern of patterns) {
    if (pattern.test(path)) {
      return true;
    }
  }
  return false;
}
