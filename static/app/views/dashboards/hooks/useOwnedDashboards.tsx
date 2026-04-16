import {useQuery} from '@tanstack/react-query';

import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {dashboardsApiOptions} from 'sentry/utils/dashboards/dashboardsApiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

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
    ...dashboardsApiOptions(organization, {
      query: {
        query,
        cursor,
        sort,
        filter: 'owned',
        pin: 'favorites',
        per_page: 20,
      },
    }),
    select: selectJsonWithHeaders,
    enabled,
  });
}
