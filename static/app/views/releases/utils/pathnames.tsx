import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

const LEGACY_RELEASES_BASE_PATHNAME = 'releases';
const RELEASES_BASE_PATHNAME = 'explore/releases';

export function makeReleasesPathname({
  path,
  organization,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
}) {
  return normalizeUrl(
    organization.features.includes('navigation-sidebar-v2')
      ? `/organizations/${organization.slug}/${RELEASES_BASE_PATHNAME}${path}`
      : `/organizations/${organization.slug}/${LEGACY_RELEASES_BASE_PATHNAME}${path}`
  );
}
