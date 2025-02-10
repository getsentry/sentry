import type {SessionApiResponse} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  groupByRelease?: boolean;
}

export default function useErrorFreeSessions({groupByRelease}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const {
    data: sessionsData,
    isPending,
    error,
  } = useApiQuery<SessionApiResponse>(
    [
      `/organizations/${organization.slug}/sessions/`,
      {
        query: {
          ...location.query,
          field: ['sum(session)'],
          groupBy: groupByRelease ? ['session.status', 'release'] : ['session.status'],
        },
      },
    ],
    {staleTime: 0}
  );

  if (isPending) {
    return {
      series: [],
      isPending: true,
      error,
    };
  }

  if (!sessionsData && !isPending) {
    return {
      series: [],
      isPending: false,
      error,
    };
  }

  if (groupByRelease) {
    // Group the data by release first
    const releaseGroups = new Map<string, typeof sessionsData.groups>();

    sessionsData.groups.forEach(group => {
      const release = group.by.release?.toString() ?? '';
      if (!releaseGroups.has(release)) {
        releaseGroups.set(release, []);
      }
      releaseGroups.get(release)!.push(group);
    });

    // Calculate healthy percentage for each release
    const healthySessionsPercentageData: number[][] = [];
    const releases: string[] = [];

    releaseGroups.forEach((groups, release) => {
      releases.push(release);

      // Get series data for each session status
      const healthySeries =
        groups.find(g => g.by['session.status'] === 'healthy')?.series['sum(session)'] ??
        [];
      const abnormalSeries =
        groups.find(g => g.by['session.status'] === 'abnormal')?.series['sum(session)'] ??
        [];
      const crashedSeries =
        groups.find(g => g.by['session.status'] === 'crashed')?.series['sum(session)'] ??
        [];
      const erroredSeries =
        groups.find(g => g.by['session.status'] === 'errored')?.series['sum(session)'] ??
        [];

      // Calculate percentage for each point in time
      const percentages = healthySeries.map((healthy, idx) => {
        const total =
          healthy +
          (abnormalSeries[idx] || 0) +
          (crashedSeries[idx] || 0) +
          (erroredSeries[idx] || 0);
        return total > 0 ? healthy / total : 1;
      });

      healthySessionsPercentageData.push(percentages);
    });

    const seriesData = healthySessionsPercentageData.map(releaseData =>
      releaseData.map((val, idx) => ({
        name: sessionsData.intervals[idx] ?? '',
        value: val,
      }))
    );

    const series =
      seriesData?.map((s, index) => ({
        data: s,
        seriesName: `successful_session_rate_${releases[index]}`,
        meta: {
          fields: {
            [`successful_session_rate_${releases[index]}`]: 'percentage' as const,
            time: 'date' as const,
          },
          units: {
            [`successful_session_rate_${releases[index]}`]: '%',
          },
        },
      })) ?? [];

    return {
      series,
      releases,
      isPending,
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
    return total > 0 ? healthyCount / total : 1;
  });

  const seriesData = healthySessionsPercentageData.map((val, idx) => {
    return {name: sessionsData.intervals[idx] ?? '', value: val};
  });

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
