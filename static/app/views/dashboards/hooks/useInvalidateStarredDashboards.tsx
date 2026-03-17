import {useCallback} from 'react';

import {useQueryClient} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getStarredDashboardsQueryKey} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';

export function useInvalidateStarredDashboards() {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const queryKey = getStarredDashboardsQueryKey(organization);

  return useCallback(() => {
    queryClient.invalidateQueries({queryKey});
  }, [queryClient, queryKey]);
}
