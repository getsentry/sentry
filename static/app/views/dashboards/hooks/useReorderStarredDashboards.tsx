import {useCallback} from 'react';

import {setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getQueryKey} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';
import {useInvalidateStarredDashboards} from 'sentry/views/dashboards/hooks/useInvalidateStarredDashboards';
import type {DashboardListItem} from 'sentry/views/dashboards/types';

export function useReorderStarredDashboards() {
  const organization = useOrganization();
  const api = useApi();
  const queryClient = useQueryClient();
  const invalidateStarredDashboards = useInvalidateStarredDashboards();
  const reorderStarredDashboards = useCallback(
    async (dashboards: DashboardListItem[]) => {
      setApiQueryData<DashboardListItem[]>(
        queryClient,
        getQueryKey(organization),
        dashboards
      );
      await api.requestPromise(
        `/organizations/${organization.slug}/dashboards/starred/order/`,
        {
          method: 'PUT',
          data: {
            dashboard_ids: dashboards.map(dashboard => dashboard.id),
          },
        }
      );
      invalidateStarredDashboards();
    },
    [api, organization, queryClient, invalidateStarredDashboards]
  );

  return reorderStarredDashboards;
}
