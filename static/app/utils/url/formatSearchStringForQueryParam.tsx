import type {MutableSearch as ParsedMutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

/**
 * Either `MutableSearch` implementation. `sentry/utils/tokenizeSearch` splits
 * the query with a hand-rolled character scanner; the parser-based
 * `sentry/components/searchSyntax/mutableSearch` runs the real search grammar
 * and is what call sites are migrating to. Both serialize through
 * `formatString()`, so anything that only needs the query string accepts either.
 */
export type AnyMutableSearch = MutableSearch | ParsedMutableSearch;

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
  query: AnyMutableSearch | string | undefined
): string | undefined {
  if (query === undefined) {
    return undefined;
  }

  // Not an `instanceof` check: that would silently pass the object straight
  // through as the query param for whichever of the two implementations it
  // was not written against.
  return typeof query === 'string' ? query : query.formatString();
}
