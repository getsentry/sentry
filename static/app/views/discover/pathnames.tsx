import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

const LEGACY_DISCOVER_BASE_PATHNAME = 'discover';
const DISCOVER_BASE_PATHNAME = 'explore/discover';

export function makeDiscoverPathname({
  path,
  organization,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
}) {
  return normalizeUrl(
    organization.features.includes('navigation-sidebar-v2')
      ? `/organizations/${organization.slug}/${DISCOVER_BASE_PATHNAME}${path}`
      : `/organizations/${organization.slug}/${LEGACY_DISCOVER_BASE_PATHNAME}${path}`
  );
}
