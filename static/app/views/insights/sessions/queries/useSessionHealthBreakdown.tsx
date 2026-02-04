import {pageFiltersToQueryParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {SessionApiResponse} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {getSessionsInterval} from 'sentry/utils/sessions';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getSessionStatusSeries} from 'sentry/views/insights/sessions/utils/sessions';

export default function useSessionHealthBreakdown({
  type,
  pageFilters,
}: {
  type: 'count' | 'rate';
  pageFilters?: PageFilters;
}) {
  const organization = useOrganization();
  const {selection: defaultPageFilters} = usePageFilters();

  const {
    data: sessionData,
    isPending,
    error,
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
          groupBy: ['session.status'],
        },
      },
    ],
    {staleTime: 0}
  );

  if (isPending || !sessionData) {
    return {
      series: [],
      isPending,
      error,
    };
  }

  // Create a map of status to their data
  const statusData = {
    crashed: getSessionStatusSeries('crashed', sessionData.groups),
    errored: getSessionStatusSeries('errored', sessionData.groups),
    unhandled: getSessionStatusSeries('unhandled', sessionData.groups),
    abnormal: getSessionStatusSeries('abnormal', sessionData.groups),
    healthy: getSessionStatusSeries('healthy', sessionData.groups),
  };

  const createDatapoints = (data: number[]) =>
    data.map((count, idx) => {
      const intervalTotal = sessionData.groups.reduce(
        (acc, group) => acc + (group.series['sum(session)']?.[idx] ?? 0),
        0
      );

      if (type === 'count') {
        return {
          name: sessionData.intervals[idx] ?? '',
          value: intervalTotal > 0 ? count : 0,
        };
      }

      return {
        name: sessionData.intervals[idx] ?? '',
        value: intervalTotal > 0 ? count / intervalTotal : 0,
      };
    });

  const createSeries = (
    data: ReturnType<typeof createDatapoints>,
    status: keyof typeof statusData
  ) => ({
    data,
    seriesName: `${status}_session_${type}`,
    meta: {
      fields: {
        [`${status}_session_${type}`]:
          type === 'count' ? ('integer' as const) : ('percentage' as const),
        time: 'date' as const,
      },
      units: {},
    },
  });

  // Wrap all session rate data in a series
  const series = Object.entries(statusData).map(([status, data]) =>
    createSeries(createDatapoints(data), status as keyof typeof statusData)
  );

  return {
    series,
    isPending,
    error,
  };
}
