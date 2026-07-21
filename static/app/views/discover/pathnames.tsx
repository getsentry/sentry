import type {Organization} from 'sentry/types/organization';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {getDiscoverDeprecation} from 'sentry/views/discover/utils';

const DISCOVER_BASE_PATHNAME = 'explore/discover';
const ERRORS_BASE_PATHNAME = 'explore/errors';

export function makeDiscoverPathname({
  path,
  organization,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
}) {
  return normalizeUrl(
    getDiscoverDeprecation(organization)
      ? `/organizations/${organization.slug}/${ERRORS_BASE_PATHNAME}${path}`
      : `/organizations/${organization.slug}/${DISCOVER_BASE_PATHNAME}${path}`
  );
}
