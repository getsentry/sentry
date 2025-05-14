import type {To} from '@remix-run/router';

import normalizeUrl from 'sentry/utils/url/normalizeUrl';

export function isLinkActive(
  to: To,
  pathname: string,
  options: {end?: boolean} = {end: false}
): boolean {
  const toPathname = normalizeUrl(typeof to === 'string' ? to : (to.pathname ?? '/'));

  if (options.end) {
    return pathname === toPathname;
  }

  return pathname.startsWith(toPathname);
}
