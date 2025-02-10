import type {SessionApiResponse} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export default function useErrorFreeSessions() {
  const location = useLocation();
  const organization = useOrganization();
  const {
    data: sessionsData,
    isPending,
    error,
  } = useApiQuery<SessionApiResponse>(
    [
      `/organizations/${organization.slug}/sessions/`,
      {query: {...location.query, field: ['sum(session)'], groupBy: ['session.status']}},
    ],
    {staleTime: 0}
  );

  if (isPending) {
    return {
      seriesData: [],
      isPending: true,
      error,
    };
  }

  if (!sessionsData && !isPending) {
    return {
      seriesData: [],
      isPending: false,
      error,
    };
  }

  // Get the healthy sessions series data
  const healthySessionsSeries =
    sessionsData.groups.find(group => group.by['session.status'] === 'healthy')?.series[
      'sum(session)'
    ] ?? [];

  // Calculate total sessions for each interval
  const totalSessionsByInterval = sessionsData.groups[0]?.series['sum(session)']?.map(
    (_, intervalIndex) =>
      sessionsData.groups.reduce(
        (acc, group) => acc + (group.series['sum(session)']?.[intervalIndex] ?? 0),
        0
      )
  );

  // Calculate percentage for each interval
  const healthySessionsPercentageData = healthySessionsSeries.map((healthyCount, idx) => {
    const total = totalSessionsByInterval?.[idx] ?? 1;
    return total > 0 ? healthyCount / total : 0;
  });

  return {
    seriesData: healthySessionsPercentageData.map((val, idx) => {
      return {name: sessionsData.intervals[idx] ?? '', value: val};
    }),
    isPending,
    error,
  };
}
