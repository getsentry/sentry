import omit from 'lodash/omit';

import {decodeList, decodeScalar} from 'sentry/utils/queryString';

export enum ReleasesDrawerFields {
  DRAWER = 'rd',

  // TODO: Namespace this so it doesn't collide with parent page's query params
  ACTIVE_REPO = 'activeRepo',
  CHART = 'rdChart',
  COMMIT_CURSOR = 'rdCiCursor',
  FILES_CURSOR = 'rdFilesCursor',
  END = 'rdEnd',
  ENVIRONMENT = 'rdEnv',
  LIST_CURSOR = 'rdListCursor',
  PROJECT = 'rdProject',
  RELEASE = 'rdRelease',
  RELEASE_PROJECT_ID = 'rdReleaseProjectId',
  START = 'rdStart',
}

/**
 * For use with `useLocationQuery` to decode the releases drawer query parameters.
 */
export const RELEASES_DRAWER_FIELD_MAP = {
  [ReleasesDrawerFields.DRAWER]: decodeScalar,
  [ReleasesDrawerFields.CHART]: decodeScalar,
  [ReleasesDrawerFields.COMMIT_CURSOR]: decodeScalar,
  [ReleasesDrawerFields.END]: decodeScalar,
  [ReleasesDrawerFields.ENVIRONMENT]: decodeList,
  [ReleasesDrawerFields.LIST_CURSOR]: decodeScalar,
  [ReleasesDrawerFields.PROJECT]: decodeList,
  [ReleasesDrawerFields.RELEASE]: decodeScalar,
  [ReleasesDrawerFields.RELEASE_PROJECT_ID]: decodeScalar,
  [ReleasesDrawerFields.START]: decodeScalar,
};

const RELEASES_DRAWER_FIELD_KEYS = Object.keys(RELEASES_DRAWER_FIELD_MAP);

/**
 * Removes the releases drawer parameters from the location query.
 * @param query Location query object
 * @returns Location query object with the releases drawer parameters removed
 */
export function cleanLocationQuery(
  query: Record<string, string[] | string | null | undefined>
) {
  return omit(query, RELEASES_DRAWER_FIELD_KEYS);
}

/**
 * Cleans location.query of all releases drawer params except for the base params (i.e. page filters params). This should be used whenever we navigate to another URL *inside* of the Releases Drawer.
 *
 * @param query Location query object
 * @returns Location query object with the base release drawer params preserved
 */
export function preserveBaseReleaseDrawerQueryParams(
  query: Record<string, string[] | string | null | undefined>
) {
  return omit(
    query,
    RELEASES_DRAWER_FIELD_KEYS.filter(
      key =>
        ![
          ReleasesDrawerFields.DRAWER,
          ReleasesDrawerFields.PROJECT,
          ReleasesDrawerFields.START,
          ReleasesDrawerFields.END,
          ReleasesDrawerFields.ENVIRONMENT,
        ].includes(key as ReleasesDrawerFields)
    )
  );
}
