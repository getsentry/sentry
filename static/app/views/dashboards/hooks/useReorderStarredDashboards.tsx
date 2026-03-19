import {
  fetchMutation,
  setApiQueryData,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
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
        url: `/organizations/${organization.slug}/dashboards/starred/order/`,
        method: 'PUT',
        data: {
          dashboard_ids: dashboards.map(dashboard => dashboard.id),
        },
      }),
    onMutate: dashboards => {
      setApiQueryData<DashboardListItem[]>(queryClient, queryKey, dashboards);
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey});
    },
  });

  return mutate;
}
