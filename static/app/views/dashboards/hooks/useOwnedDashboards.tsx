import {useQuery} from '@tanstack/react-query';

import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
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
  return useQuery({
    ...apiOptions.as<DashboardListItem[]>()(
      '/organizations/$organizationIdOrSlug/dashboards/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          query,
          cursor,
          sort,
          filter: 'owned',
          pin: 'favorites',
          per_page: 20,
        },
        staleTime: 0,
      }
    ),
    select: selectJsonWithHeaders,
    enabled,
  });
}
