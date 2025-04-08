import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {CODECOV_BASE_URL} from 'sentry/views/codecov/settings';

interface MakeCodecovPathnameArgs {
  organization: Organization;
  path: '/' | `/${string}/`;
}

export function makeCodecovPathname({path, organization}: MakeCodecovPathnameArgs) {
  return normalizeUrl(`/organizations/${organization.slug}/${CODECOV_BASE_URL}${path}`);
}
