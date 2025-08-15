import {useCallback} from 'react';

import {useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useGetStarredDashboards} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';

export function useResetDashboardLists() {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const getStarredDashboards = useGetStarredDashboards();

  return useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: [`/organizations/${organization.slug}/dashboards/`],
    });
    getStarredDashboards.refetch();
  }, [queryClient, organization, getStarredDashboards]);
}
