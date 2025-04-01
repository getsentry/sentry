import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {prefersStackedNav} from 'sentry/views/nav/prefersStackedNav';

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
    prefersStackedNav()
      ? `/organizations/${organization.slug}/${RELEASES_BASE_PATHNAME}${path}`
      : `/organizations/${organization.slug}/${LEGACY_RELEASES_BASE_PATHNAME}${path}`
  );
}
