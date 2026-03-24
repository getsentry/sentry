import {MutableSearch} from 'sentry/utils/tokenizeSearch';

/**
 * Formats a search string for use as a query parameter.
 * This is useful for cases where we need to pass a search string to an API
 * that expects a query parameter, but we want to ensure that the string is
 * properly formatted for the API.
 *
 * @param query - The search string to format.
 * @returns The formatted search string.
 */
export function formatSearchStringForQueryParam(
  query: MutableSearch | string | undefined
): string | undefined {
  if (typeof query === 'undefined') {
    return undefined;
  }

  if (query instanceof MutableSearch) {
    return query.formatString();
  }

  return query;
}
