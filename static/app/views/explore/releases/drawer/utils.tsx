import omit from 'lodash/omit';
import {parseAsString} from 'nuqs';

import {parseAsStringArray} from 'sentry/utils/url/parseAsStringArray';

export enum ReleasesDrawerFields {
  DRAWER = 'rd',

  // TODO: Namespace this so it doesn't collide with parent page's query params
  ACTIVE_REPO = 'activeRepo',
  CHART = 'rdChart',
  COMMIT_CURSOR = 'rdCiCursor',
  FILES_CURSOR = 'rdFilesCursor',
  FLAGS_CURSOR = 'rdFlagsCursor',
  END = 'rdEnd',
  ENVIRONMENT = 'rdEnv',
  EVENT_ID = 'rdEvent',
  LIST_CURSOR = 'rdListCursor',
  PROJECT = 'rdProject',
  RELEASE = 'rdRelease',
  RELEASE_PROJECT_ID = 'rdReleaseProjectId',
  START = 'rdStart',
  SOURCE = 'rdSource',
}

/**
 * For use with nuqs' `useQueryStates` to read the releases drawer query parameters.
 */
export const RELEASES_DRAWER_PARSERS = {
  [ReleasesDrawerFields.DRAWER]: parseAsString.withDefault(''),
  [ReleasesDrawerFields.CHART]: parseAsString.withDefault(''),
  [ReleasesDrawerFields.COMMIT_CURSOR]: parseAsString.withDefault(''),
  [ReleasesDrawerFields.END]: parseAsString.withDefault(''),
  [ReleasesDrawerFields.ENVIRONMENT]: parseAsStringArray,
  [ReleasesDrawerFields.EVENT_ID]: parseAsString.withDefault(''),
  [ReleasesDrawerFields.FILES_CURSOR]: parseAsString.withDefault(''),
  [ReleasesDrawerFields.FLAGS_CURSOR]: parseAsString.withDefault(''),
  [ReleasesDrawerFields.LIST_CURSOR]: parseAsString.withDefault(''),
  [ReleasesDrawerFields.PROJECT]: parseAsStringArray,
  [ReleasesDrawerFields.RELEASE]: parseAsString.withDefault(''),
  [ReleasesDrawerFields.RELEASE_PROJECT_ID]: parseAsString.withDefault(''),
  [ReleasesDrawerFields.START]: parseAsString.withDefault(''),
  [ReleasesDrawerFields.SOURCE]: parseAsString.withDefault(''),
};

const RELEASES_DRAWER_FIELD_KEYS = Object.keys(RELEASES_DRAWER_PARSERS);

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
 * Cleans location.query of all releases drawer cursors
 *
 * @param query Location query object
 * @returns Location query object with all releases drawer cursors removed
 */
export function cleanReleaseCursors(
  query: Record<string, string[] | string | null | undefined>
) {
  // Listed directly rather than intersected with RELEASES_DRAWER_FIELD_KEYS:
  // ACTIVE_REPO has no parser, so the intersection silently dropped it and left
  // the repo selection behind.
  return omit(query, [
    ReleasesDrawerFields.COMMIT_CURSOR,
    ReleasesDrawerFields.FILES_CURSOR,
    ReleasesDrawerFields.LIST_CURSOR,
    ReleasesDrawerFields.ACTIVE_REPO,
  ]);
}
