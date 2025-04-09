import type {To} from '@remix-run/router';
import type {LocationDescriptor} from 'history';

import {SIDEBAR_NAVIGATION_SOURCE} from 'sentry/components/sidebar/utils';
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

/**
 * Creates a `LocationDescriptor` from a URL string that may contain search params
 */
export function makeLinkPropsFromTo(to: string): {
  state: Record<PropertyKey, unknown>;
  to: LocationDescriptor;
} {
  return {
    to,
    state: {source: SIDEBAR_NAVIGATION_SOURCE},
  };
}
