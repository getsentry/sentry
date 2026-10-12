import {mutationOptions, useMutation, useQueryClient} from '@tanstack/react-query';

import {updateDashboardTitle} from 'sentry/actionCreators/dashboards';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getDashboardRevisionsQueryKey} from 'sentry/views/dashboards/hooks/useDashboardRevisions';
import {getStarredDashboardsQueryKey} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';

type RenameDashboardVariables = {
  dashboardId: string;
  title: string;
};

function useRenameDashboardMutationOptions() {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: ({dashboardId, title}: RenameDashboardVariables) =>
      updateDashboardTitle(organization.slug, dashboardId, title),
    onSuccess: updatedDashboard => {
      // The starred list in the secondary nav renders its own copy of the
      // title, and the backend snapshots a revision on every write — including
      // a title-only one.
      queryClient.invalidateQueries({
        queryKey: getStarredDashboardsQueryKey(organization),
      });
      queryClient.invalidateQueries({
        queryKey: getDashboardRevisionsQueryKey(organization.slug, updatedDashboard.id),
      });
    },
  });
}

export function useRenameDashboard() {
  return useMutation(useRenameDashboardMutationOptions());
}
