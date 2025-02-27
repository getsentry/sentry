import type {SessionApiResponse} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export default function useErrorFreeSessions() {
  const location = useLocation();
  const organization = useOrganization();

  const locationWithoutWidth = {
    ...location,
    query: {
      ...location.query,
      width_health_table: undefined,
      width_adoption_table: undefined,
      cursor_health_table: undefined,
      cursor_adoption_table: undefined,
    },
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
          ...locationWithoutWidth.query,
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

  const getStatusSeries = (status: string, groups: typeof sessionData.groups) =>
    groups.find(group => group.by['session.status'] === status)?.series['sum(session)'] ??
    [];

  // Returns series data not grouped by release
  const seriesData = getStatusSeries('healthy', sessionData.groups).map(
    (healthyCount, idx) => {
      const intervalTotal = sessionData.groups.reduce(
        (acc, group) => acc + (group.series['sum(session)']?.[idx] ?? 0),
        0
      );

      return {
        name: sessionData.intervals[idx] ?? '',
        value: intervalTotal > 0 ? healthyCount / intervalTotal : 1,
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
