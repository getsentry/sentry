import omit from 'lodash/omit';

import {decodeList, decodeScalar} from 'sentry/utils/queryString';

enum ReleasesDrawerFields {
  DRAWER = 'rd',
  CHART = 'rdChart',
  COMMIT_CURSOR = 'rdCiCursor',
  END = 'rdEnd',
  ENVIRONMENT = 'rdEnv',
  LIST_CURSOR = 'rdListCursor',
  PROJECT = 'rdProject',
  RELEASE = 'rdRelease',
  RELEASE_PROJECT_ID = 'rdReleaseProjectId',
  START = 'rdStart',
}

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
