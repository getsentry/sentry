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
    prefersStackedNav(organization)
      ? `/organizations/${organization.slug}/${RELEASES_BASE_PATHNAME}${path}`
      : `/organizations/${organization.slug}/${LEGACY_RELEASES_BASE_PATHNAME}${path}`
  );
}

export function makeReleaseDrawerPathname({
  location,
  release,
  projectId,
  source,
}: {
  location: Location;
  release: string;
  source: string;
  projectId?: string | string[] | null;
}) {
  return {
    query: {
      ...cleanReleaseCursors(location.query),
      [ReleasesDrawerFields.DRAWER]: 'show',
      [ReleasesDrawerFields.RELEASE]: release,
      [ReleasesDrawerFields.RELEASE_PROJECT_ID]: projectId,
      [ReleasesDrawerFields.SOURCE]: source,
    },
  };
}
