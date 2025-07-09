import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {DashboardListItem} from 'sentry/views/dashboards/types';

export function useOwnedDashboards({
  query,
  cursor,
  sort,
  enabled,
}: {
  cursor: string;
  enabled: boolean;
  query: string;
  sort: string;
}) {
  const organization = useOrganization();
  return useApiQuery<DashboardListItem[]>(
    [
      `/organizations/${organization.slug}/dashboards/`,
      {
        query: {
          query,
          cursor,
          sort,
          filter: 'owned',
          pin: 'favorites',
          per_page: 20,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: organization.features.includes('dashboards-starred-reordering') && enabled,
    }
  );
}
