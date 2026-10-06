import {mutationOptions, useMutation, useQueryClient} from '@tanstack/react-query';

import {updateDashboard} from 'sentry/actionCreators/dashboards';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getDashboardRevisionsQueryKey} from 'sentry/views/dashboards/hooks/useDashboardRevisions';
import {getStarredDashboardsQueryKey} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';
import type {DashboardDetails} from 'sentry/views/dashboards/types';

export type UpdateDashboardVariables = {
  dashboard: DashboardDetails;
  revisionSource?: string | undefined;
};

function useUpdateDashboardMutationOptions() {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: ({dashboard, revisionSource}: UpdateDashboardVariables) =>
      updateDashboard(organization.slug, dashboard, {revisionSource}),
    onSuccess: updatedDashboard => {
      queryClient.invalidateQueries({
        queryKey: getDashboardRevisionsQueryKey(organization.slug, updatedDashboard.id),
      });
      queryClient.invalidateQueries({
        queryKey: getStarredDashboardsQueryKey(organization),
      });
    },
  });
}

export function useUpdateDashboard() {
  return useMutation(useUpdateDashboardMutationOptions());
}
