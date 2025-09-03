import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {PREVENT_BASE_URL} from 'sentry/views/prevent/settings';

interface MakePreventPathnameArgs {
  organization: Organization;
  path: '/' | `/${string}/`;
}

export function makePreventPathname({path, organization}: MakePreventPathnameArgs) {
  return normalizeUrl(`/organizations/${organization.slug}/${PREVENT_BASE_URL}${path}`);
}
