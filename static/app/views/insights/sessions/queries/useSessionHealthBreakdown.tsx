import type {SessionApiResponse} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {getStatusSeries} from 'sentry/views/insights/sessions/utils/sessions';

export default function useSessionHealthBreakdown({type}: {type: 'count' | 'rate'}) {
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

  // Create a map of status to their data
  const statusData = {
    healthy: getStatusSeries('healthy', sessionData.groups),
    crashed: getStatusSeries('crashed', sessionData.groups),
    errored: getStatusSeries('errored', sessionData.groups),
    abnormal: getStatusSeries('abnormal', sessionData.groups),
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
          type === 'count' ? ('number' as const) : ('percentage' as const),
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
