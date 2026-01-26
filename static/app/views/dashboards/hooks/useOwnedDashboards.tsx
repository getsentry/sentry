import getApiUrl from 'sentry/utils/api/getApiUrl';
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
      getApiUrl('/organizations/$organizationIdOrSlug/dashboards/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
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
      enabled,
    }
  );
}
