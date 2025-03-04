import type {SessionApiResponse} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {getCountStatusSeries} from 'sentry/views/insights/sessions/utils/sessions';

export default function useUserHealthBreakdown({type}: {type: 'count' | 'rate'}) {
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
    data: userData,
    isPending,
    error,
  } = useApiQuery<SessionApiResponse>(
    [
      `/organizations/${organization.slug}/sessions/`,
      {
        query: {
          ...locationWithoutWidth.query,
          field: ['count_unique(user)'],
          groupBy: ['session.status'],
        },
      },
    ],
    {staleTime: 0}
  );

  if (isPending || !userData) {
    return {
      series: [],
      isPending,
      error,
    };
  }

  // Create a map of status to their data
  const statusData = {
    healthy: getCountStatusSeries('healthy', userData.groups),
    crashed: getCountStatusSeries('crashed', userData.groups),
    errored: getCountStatusSeries('errored', userData.groups),
    abnormal: getCountStatusSeries('abnormal', userData.groups),
  };

  const createDatapoints = (data: number[]) =>
    data.map((count, idx) => {
      const intervalTotal = userData.groups.reduce(
        (acc, group) => acc + (group.series['count_unique(user)']?.[idx] ?? 0),
        0
      );

      if (type === 'count') {
        return {
          name: userData.intervals[idx] ?? '',
          value: intervalTotal > 0 ? count : 0,
        };
      }

      return {
        name: userData.intervals[idx] ?? '',
        value: intervalTotal > 0 ? count / intervalTotal : 0,
      };
    });

  const createSeries = (
    data: ReturnType<typeof createDatapoints>,
    status: keyof typeof statusData
  ) => ({
    data,
    seriesName: `${status}_user_${type}`,
    meta: {
      fields: {
        [`${status}_user_${type}`]:
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
