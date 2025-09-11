import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

const DISCOVER_BASE_PATHNAME = 'explore/discover';

export function makeDiscoverPathname({
  path,
  organization,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
}) {
  return normalizeUrl(
    `/organizations/${organization.slug}/${DISCOVER_BASE_PATHNAME}${path}`
  );
}
