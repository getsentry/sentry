import {useCallback} from 'react';

import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useGetStarredDashboards} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';

export function useResetDashboardLists() {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const getStarredDashboards = useGetStarredDashboards();

  return useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: [
        getApiUrl('/organizations/$organizationIdOrSlug/dashboards/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
      ],
    });
    getStarredDashboards.refetch();
  }, [queryClient, organization, getStarredDashboards]);
}
