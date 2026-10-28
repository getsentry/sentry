import type {LocationDescriptor} from 'history';

import {legacyLocationDescriptorToTo} from 'sentry/router/legacy/location';

export function getLocationHref(to: LocationDescriptor): string {
  const resolved = legacyLocationDescriptorToTo(to);

  if (typeof resolved === 'string') {
    return resolved;
  }

  return `${resolved.pathname ?? ''}${resolved.search ?? ''}${resolved.hash ?? ''}`;
}

export function isExternalLocation(to: LocationDescriptor): boolean {
  const currentUrl = new URL(window.location.href);
  const targetUrl = new URL(getLocationHref(to), currentUrl.href);
  return targetUrl.origin !== currentUrl.origin;
}
