import type {PageFilters} from 'sentry/types/core';
import type {SessionApiResponse} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {getSessionsInterval} from 'sentry/utils/sessions';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getSessionStatusSeries} from 'sentry/views/insights/sessions/utils/sessions';

export default function useErroredSessions({pageFilters}: {pageFilters?: PageFilters}) {
  const location = useLocation();
  const organization = useOrganization();
  const {
    selection: {datetime},
  } = usePageFilters();

  const locationQuery = {
    ...location.query,
    query: undefined,
    width: undefined,
    cursor: undefined,
  };

  const {
    data: sessionData,
    isPending,
    error,
  } = useApiQuery<SessionApiResponse>(
    [
      `/organizations/${organization.slug}/sessions/`,
      {
        query: {
          ...locationQuery,
          interval: getSessionsInterval(pageFilters ? pageFilters.datetime : datetime),
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

  // Returns series data not grouped by release
  const seriesData = getSessionStatusSeries('healthy', sessionData.groups).map(
    (healthyCount, idx) => {
      const intervalTotal = sessionData.groups.reduce(
        (acc, group) => acc + (group.series['sum(session)']?.[idx] ?? 0),
        0
      );

      return {
        name: sessionData.intervals[idx] ?? '',
        value: intervalTotal > 0 ? (intervalTotal - healthyCount) / intervalTotal : 0,
      };
    }
  );

  const series = [
    {
      data: seriesData,
      seriesName: 'successful_session_rate',
      meta: {
        fields: {
          successful_session_rate: 'percentage' as const,
          time: 'date' as const,
        },
        units: {
          successful_session_rate: '%',
        },
      },
    },
  ];

  return {
    series,
    isPending,
    error,
  };
}
