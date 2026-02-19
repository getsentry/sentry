import {
  makeDashboardHistoryQueryKey,
  type DashboardHistoryEntry,
} from 'sentry/actionCreators/dashboards';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface UseDashboardHistoryOptions {
  dashboardId: string;
  enabled?: boolean;
}

export function useDashboardHistory({
  dashboardId,
  enabled = true,
}: UseDashboardHistoryOptions) {
  const organization = useOrganization();
  return useApiQuery<DashboardHistoryEntry[]>(
    makeDashboardHistoryQueryKey(organization.slug, dashboardId),
    {
      staleTime: 30_000,
      enabled,
    }
  );
}
