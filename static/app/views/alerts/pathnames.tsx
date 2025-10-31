import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

const ALERTS_BASE_PATHNAME = '/issues/alerts';

export function makeAlertsPathname({
  path,
  organization,
  useLegacyBasePath = true,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
  useLegacyBasePath?: boolean;
}) {
  let basePath = '';
  if (useLegacyBasePath) {
    basePath = ALERTS_BASE_PATHNAME;
  }

  return normalizeUrl(`/organizations/${organization.slug}${basePath}${path}`);
}
