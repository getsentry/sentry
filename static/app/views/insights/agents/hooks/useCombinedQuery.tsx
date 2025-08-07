import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';

/**
 * Combines a base query with a query from the URL.
 *
 * @param baseQuery - The base query to combine with the URL query.
 * @returns The combined query.
 */
export function useCombinedQuery(baseQuery = '') {
  const {query} = useLocationQuery({
    fields: {
      query: decodeScalar,
    },
  });

  if (!query) {
    return baseQuery;
  }

  if (!baseQuery) {
    return query;
  }

  return `(${baseQuery}) and (${query})`.trim();
}
