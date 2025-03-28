import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {prefersStackedNav} from 'sentry/views/nav/prefersStackedNav';

const LEGACY_ALERTS_BASE_PATHNAME = 'alerts';
const ALERTS_BASE_PATHNAME = 'issues/alerts';

export function makeAlertsPathname({
  path,
  organization,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
}) {
  return normalizeUrl(
    prefersStackedNav()
      ? `/organizations/${organization.slug}/${ALERTS_BASE_PATHNAME}${path}`
      : `/organizations/${organization.slug}/${LEGACY_ALERTS_BASE_PATHNAME}${path}`
  );
}
