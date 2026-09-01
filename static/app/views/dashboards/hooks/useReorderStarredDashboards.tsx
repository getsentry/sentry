import {useMutation, useQueryClient} from '@tanstack/react-query';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getStarredDashboardsQueryKey} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';
import type {DashboardListItem} from 'sentry/views/dashboards/types';

export function useReorderStarredDashboards() {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const queryKey = getStarredDashboardsQueryKey(organization);

  const {mutate} = useMutation({
    mutationFn: (dashboards: DashboardListItem[]) =>
      fetchMutation({
        url: getApiUrl('/organizations/$organizationIdOrSlug/dashboards/starred/order/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        method: 'PUT',
        data: {
          dashboard_ids: dashboards.map(dashboard => dashboard.id),
        },
      }),
    onMutate: dashboards => {
      queryClient.setQueryData(queryKey, prev =>
        prev ? {...prev, json: dashboards} : prev
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey});
    },
  });

  return mutate;
}
