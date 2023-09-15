import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  DeadRageSelectorListResponse,
  DeadRageSelectorQueryParams,
} from 'sentry/views/replays/types';

export default function useRageDeadSelectors(params: DeadRageSelectorQueryParams) {
  const organization = useOrganization();
  const location = useLocation();
  const {query} = location;

  const {isLoading, isError, data, getResponseHeader} =
    useApiQuery<DeadRageSelectorListResponse>(
      [
        `/organizations/${organization.slug}/replay-selectors/`,
        {
          query: {
            pathname: query.pathname,
            cursor: query.cursor,
            per_page: params.per_page ?? 10,
            sort: params.sort ?? query.sort,
          },
        },
      ],
      {staleTime: Infinity}
    );

  return {
    isLoading,
    isError,
    data: data ? data.data : [],
    pageLinks: getResponseHeader?.('Link') ?? undefined,
  };
}
