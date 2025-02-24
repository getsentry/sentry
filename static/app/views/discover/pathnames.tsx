import {prefersStackedNav} from 'sentry/components/nav/prefersStackedNav';
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
    prefersStackedNav()
      ? `/organizations/${organization.slug}/${DISCOVER_BASE_PATHNAME}${path}`
      : `/organizations/${organization.slug}/${LEGACY_DISCOVER_BASE_PATHNAME}${path}`
  );
}
