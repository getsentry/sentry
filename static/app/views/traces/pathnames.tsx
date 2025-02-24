import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

const LEGACY_TRACES_BASE_PATHNAME = 'traces';
const TRACES_BASE_PATHNAME = 'explore/traces';

export function makeTracesPathname({
  path,
  organization,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
}) {
  return normalizeUrl(
    organization.features.includes('navigation-sidebar-v2')
      ? `/organizations/${organization.slug}/${TRACES_BASE_PATHNAME}${path}`
      : `/organizations/${organization.slug}/${LEGACY_TRACES_BASE_PATHNAME}${path}`
  );
}
