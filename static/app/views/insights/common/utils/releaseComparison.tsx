import {defined} from 'sentry/utils';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

export function appendReleaseFilters(
  query: MutableSearch,
  primaryRelease: string | undefined
) {
  // Treat empty strings as undefined
  const validPrimary =
    primaryRelease && primaryRelease !== '' ? primaryRelease : undefined;

  let queryString = query.formatString();
  if (defined(validPrimary)) {
    queryString = query.copy().addStringFilter(`release:${validPrimary}`).formatString();
  }
  return queryString;
}
// trivial change for CI testing
