import type {To} from '@remix-run/router';
import type {LocationDescriptor} from 'history';

import {SIDEBAR_NAVIGATION_SOURCE} from 'sentry/components/sidebar/utils';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

export function isLinkActive(
  to: To,
  pathname: string,
  options: {end?: boolean} = {end: false}
): boolean {
  const toPathname = normalizeUrl(typeof to === 'string' ? to : to.pathname ?? '/');

  if (options.end) {
    return pathname === toPathname;
  }

  return pathname.startsWith(toPathname);
}

/**
 * Creates a `LocationDescriptor` from a URL string that may contain search params
 */
export function makeLinkPropsFromTo(to: string): {
  state: Record<PropertyKey, unknown>;
  to: LocationDescriptor;
} {
  const {pathname, search, hash} = new URL(
    to,
    // For partial URLs (pathname + hash? + params?), we use a
    // placeholder base URL to create a parseable URL string.
    // Note that both the URL scheme and domain are discarded.
    !to.startsWith('http') ? 'https://sentry.io/' : undefined
  );

  return {
    to: normalizeUrl({
      pathname,
      search,
      hash,
    }),
    state: {source: SIDEBAR_NAVIGATION_SOURCE},
  };
}
