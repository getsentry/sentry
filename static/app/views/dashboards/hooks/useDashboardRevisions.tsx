import {
  makeDashboardRevisionsQueryKey,
  type DashboardRevision,
} from 'sentry/actionCreators/dashboards';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

interface UseDashboardRevisionsOptions {
  dashboardId: string;
  enabled?: boolean;
}

export function useDashboardRevisions({
  dashboardId,
  enabled = true,
}: UseDashboardRevisionsOptions) {
  const organization = useOrganization();
  return useApiQuery<DashboardRevision[]>(
    makeDashboardRevisionsQueryKey(organization.slug, dashboardId),
    {
      staleTime: 30_000,
      enabled,
    }
  );
}
