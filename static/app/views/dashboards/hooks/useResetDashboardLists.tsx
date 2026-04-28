import {useCallback} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {dashboardsApiOptions} from 'sentry/utils/dashboards/dashboardsApiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useGetStarredDashboards} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';

export function useResetDashboardLists() {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const getStarredDashboards = useGetStarredDashboards();

  return useCallback(() => {
    queryClient.invalidateQueries(dashboardsApiOptions(organization));
    getStarredDashboards.refetch();
  }, [queryClient, organization, getStarredDashboards]);
}
