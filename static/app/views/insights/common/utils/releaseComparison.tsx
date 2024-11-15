import {defined} from 'sentry/utils';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

export function appendReleaseFilters(
  query: MutableSearch,
  primaryRelease: string | undefined,
  secondaryRelease?: string
) {
  let queryString: string = query.formatString();
  if (
    defined(primaryRelease) &&
    defined(secondaryRelease) &&
    primaryRelease !== secondaryRelease
  ) {
    queryString = query
      .copy()
      .addDisjunctionFilterValues('release', [primaryRelease, secondaryRelease])
      .formatString();
  } else if (defined(primaryRelease)) {
    queryString = query
      .copy()
      .addStringFilter(`release:${primaryRelease}`)
      .formatString();
  }
  return queryString;
}
