import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  DeadRageSelectorListResponse,
  DeadRageSelectorQueryParams,
} from 'sentry/views/replays/types';

export default function useRageDeadSelectors(
  params: DeadRageSelectorQueryParams = {per_page: 10, sort: '-count_dead_clicks'}
) {
  const organization = useOrganization();
  const location = useLocation();
  const {query} = location;

  return useApiQuery<DeadRageSelectorListResponse>(
    [
      `/organizations/${organization.slug}/replay-selectors/`,
      {
        query: {
          ...query,
          per_page: params.per_page,
          sort: params.sort,
        },
      },
    ],
    {staleTime: Infinity}
  );
}
