import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

const TRACES_BASE_PATHNAME = 'explore/traces';

export function makeTracesPathname({
  path,
  organization,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
}) {
  return normalizeUrl(
    `/organizations/${organization.slug}/${TRACES_BASE_PATHNAME}${path}`
  );
}
