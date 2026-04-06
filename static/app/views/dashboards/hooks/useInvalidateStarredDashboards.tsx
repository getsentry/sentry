import {useCallback} from 'react';

import {useQueryClient} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getStarredDashboardsQueryKey} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';

export function useInvalidateStarredDashboards() {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({queryKey: getStarredDashboardsQueryKey(organization)});
  }, [queryClient, organization]);
}
