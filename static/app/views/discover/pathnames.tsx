import type {Organization} from 'sentry/types/organization';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';

const ERRORS_BASE_PATHNAME = 'explore/errors';

export function makeDiscoverPathname({
  path,
  organization,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
}) {
  return normalizeUrl(
    `/organizations/${organization.slug}/${ERRORS_BASE_PATHNAME}${path}`
  );
}
