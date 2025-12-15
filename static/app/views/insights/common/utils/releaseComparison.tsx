import {defined} from 'sentry/utils';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

export function appendReleaseFilters(
  query: MutableSearch,
  primaryRelease: string | undefined,
  secondaryRelease?: string
) {
  // Treat empty strings as undefined
  const validPrimary =
    primaryRelease && primaryRelease !== '' ? primaryRelease : undefined;
  const validSecondary =
    secondaryRelease && secondaryRelease !== '' ? secondaryRelease : undefined;

  let queryString: string = query.formatString();
  if (
    defined(validPrimary) &&
    defined(validSecondary) &&
    validPrimary !== validSecondary
  ) {
    queryString = query
      .copy()
      .addDisjunctionFilterValues('release', [validPrimary, validSecondary])
      .formatString();
  } else if (defined(validPrimary)) {
    queryString = query.copy().addStringFilter(`release:${validPrimary}`).formatString();
  }
  return queryString;
}
