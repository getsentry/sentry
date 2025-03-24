import {prefersStackedNav} from 'sentry/components/nav/prefersStackedNav';
import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

const LEGACY_REPLAYS_BASE_PATHNAME = 'replays';
const REPLAYS_BASE_PATHNAME = 'explore/replays';

export function makeReplaysPathname({
  path,
  organization,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
}) {
  return normalizeUrl(
    prefersStackedNav()
      ? `/organizations/${organization.slug}/${REPLAYS_BASE_PATHNAME}${path}`
      : `/organizations/${organization.slug}/${LEGACY_REPLAYS_BASE_PATHNAME}${path}`
  );
}
