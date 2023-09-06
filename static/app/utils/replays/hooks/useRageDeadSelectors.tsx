import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export function useRageDeadSelectors(limit: number, sort: string) {
  const organization = useOrganization();
  const location = useLocation();
  const {query} = location;

  type RageDeadSelectorResponse = {
    count_dead_clicks: number;
    count_rage_clicks: number;
    dom_element: string;
  };

  return useApiQuery<RageDeadSelectorResponse[]>(
    [
      `/organizations/${organization.slug}/replay-selectors/`,
      {
        query: {...query, limit, sort},
      },
    ],
    {staleTime: Infinity}
  );
}
