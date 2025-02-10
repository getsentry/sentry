import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

const LEGACY_PROFILING_BASE_PATHNAME = 'profiling';
const PROFILING_BASE_PATHNAME = 'explore/profiling';

export function makeProfilingPathname({
  path,
  organization,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
}) {
  return normalizeUrl(
    organization.features.includes('navigation-sidebar-v2')
      ? `/organizations/${organization.slug}/${PROFILING_BASE_PATHNAME}${path}`
      : `/organizations/${organization.slug}/${LEGACY_PROFILING_BASE_PATHNAME}${path}`
  );
}
