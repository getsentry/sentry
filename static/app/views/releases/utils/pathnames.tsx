import type {Location} from 'history';

import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {prefersStackedNav} from 'sentry/views/nav/prefersStackedNav';
import {
  cleanReleaseCursors,
  ReleasesDrawerFields,
} from 'sentry/views/releases/drawer/utils';

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

export function makeReleaseDrawerPathname({
  location,
  release,
}: {
  location: Location;
  release: string;
}) {
  return {
    query: {
      ...cleanReleaseCursors(location.query),
      [ReleasesDrawerFields.DRAWER]: 'show',
      [ReleasesDrawerFields.RELEASE]: release,
    },
  };
}
