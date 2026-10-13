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

/**
 * Cleans location.query of all releases drawer cursors
 *
 * @param query Location query object
 * @returns Location query object with all releases drawer cursors removed
 */
export function cleanReleaseCursors(
  query: Record<string, string[] | string | null | undefined>
) {
  // Keep this list explicit: ACTIVE_REPO is parsed separately from
  // RELEASES_DRAWER_PARSERS but must be cleared with the cursor state.
  return omit(query, [
    ReleasesDrawerFields.COMMIT_CURSOR,
    ReleasesDrawerFields.FILES_CURSOR,
    ReleasesDrawerFields.LIST_CURSOR,
    ReleasesDrawerFields.ACTIVE_REPO,
  ]);
}
