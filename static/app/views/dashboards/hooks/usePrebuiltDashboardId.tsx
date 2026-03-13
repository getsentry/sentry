import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {DashboardDetails} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {makeLinkedDashboardsQueryKey} from 'sentry/views/dashboards/utils/resolveLinkedDashboardIds';

/**
 * Fetches the real database ID for a prebuilt dashboard by its prebuilt ID.
 * Returns undefined while loading or if the dashboard isn't found.
 */
export function usePrebuiltDashboardId(
  prebuiltId?: PrebuiltDashboardId
): string | undefined {
  const organization = useOrganization();

  const {data} = useApiQuery<DashboardDetails[]>(
    makeLinkedDashboardsQueryKey(organization.slug, prebuiltId ? [prebuiltId] : []),
    {
      enabled: !!prebuiltId,
      staleTime: Infinity,
      retry: false,
    }
  );

  return data?.find(d => d.prebuiltId === prebuiltId)?.id;
}
