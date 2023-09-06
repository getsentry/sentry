import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

type RageDeadSelectorResponse = {
  count_dead_clicks: number;
  count_rage_clicks: number;
  dom_element: string;
};

export function useRageDeadSelectors(per_page?: number, sort?: string) {
  const organization = useOrganization();
  const location = useLocation();
  const {query} = location;

  return useApiQuery<RageDeadSelectorResponse[]>(
    [
      `/organizations/${organization.slug}/replay-selectors/`,
      {
        query: {...query, per_page: per_page ?? 10, sort: sort ?? '-count_dead_clicks'},
      },
    ],
    {staleTime: Infinity}
  );
}
