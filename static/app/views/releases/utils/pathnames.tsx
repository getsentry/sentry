import type {Location} from 'history';

import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {
  cleanReleaseCursors,
  ReleasesDrawerFields,
} from 'sentry/views/releases/drawer/utils';

const RELEASES_BASE_PATHNAME = 'explore/releases';

export function makeReleasesPathname({
  path,
  organization,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
}) {
  return normalizeUrl(
    `/organizations/${organization.slug}/${RELEASES_BASE_PATHNAME}${path}`
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
