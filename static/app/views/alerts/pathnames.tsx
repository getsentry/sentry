import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

const ALERTS_BASE_PATHNAME = 'issues/alerts';

export function makeAlertsPathname({
  path,
  organization,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
}) {
  return normalizeUrl(
    `/organizations/${organization.slug}/${ALERTS_BASE_PATHNAME}${path}`
  );
}
