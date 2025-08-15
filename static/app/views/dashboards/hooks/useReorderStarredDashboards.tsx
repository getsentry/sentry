import {useCallback} from 'react';

import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useInvalidateStarredDashboards} from 'sentry/views/dashboards/hooks/useInvalidateStarredDashboards';
import type {DashboardListItem} from 'sentry/views/dashboards/types';

export function useReorderStarredDashboards() {
  const organization = useOrganization();
  const api = useApi();
  const invalidateStarredDashboards = useInvalidateStarredDashboards();
  const reorderStarredDashboards = useCallback(
    async (dashboards: DashboardListItem[]) => {
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
    [api, organization.slug, invalidateStarredDashboards]
  );

  return reorderStarredDashboards;
}
