import {useFetchRecentSearches} from 'sentry/actionCreators/savedSearches';
import {useSearchQueryBuilderConfig} from 'sentry/components/searchQueryBuilder/context';

export function useRecentSearches() {
  const {recentSearches, recentSearchesQuery, namespace} = useSearchQueryBuilderConfig();

  return useFetchRecentSearches(
    {
      savedSearchType: recentSearches ?? null,
      namespace,
      query: recentSearchesQuery,
      limit: 10,
    },
    {
      staleTime: 30_000,
    }
  );
}
