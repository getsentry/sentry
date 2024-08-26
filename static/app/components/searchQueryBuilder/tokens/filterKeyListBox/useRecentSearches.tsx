import {useFetchRecentSearches} from 'sentry/actionCreators/savedSearches';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';

export function useRecentSearches() {
  const {recentSearches} = useSearchQueryBuilder();

  return useFetchRecentSearches(
    {
      savedSearchType: recentSearches ?? null,
      limit: 10,
    },
    {
      staleTime: 30_000,
    }
  );
}
