import {pageFiltersToQueryParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {SessionApiResponse} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {getSessionsInterval} from 'sentry/utils/sessions';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export default function useSessionProjectTotal({
  pageFilters,
}: {
  pageFilters?: PageFilters;
}) {
  const organization = useOrganization();
  const {selection: defaultPageFilters} = usePageFilters();

  const {
    data: projSessionData,
    isPending,
    isError,
  } = useApiQuery<SessionApiResponse>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/sessions/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          ...pageFiltersToQueryParams(pageFilters || defaultPageFilters),
          interval: getSessionsInterval(
            pageFilters ? pageFilters.datetime : defaultPageFilters.datetime
          ),
          field: ['sum(session)'],
          groupBy: ['project'],
        },
      },
    ],
    {staleTime: 0}
  );

  if (isPending || isError || !projSessionData) {
    return 0;
  }

  return projSessionData.groups.length
    ? (projSessionData.groups[0]!.totals['sum(session)'] ?? 0)
    : 0;
}
