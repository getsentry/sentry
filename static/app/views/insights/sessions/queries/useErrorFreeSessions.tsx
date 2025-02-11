import type {SessionApiResponse} from 'sentry/types/organization';
import {percent} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useSessionAdoptionRate from 'sentry/views/insights/sessions/queries/useSessionProjectTotal';

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

  const projTotal = useSessionAdoptionRate();

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

  // Returns series data for each release
  if (groupByRelease) {
    const releaseGroups = new Map<string, typeof sessionsData.groups>();
    const releaseAdoption = new Map<string, number>();

    sessionsData.groups.forEach(group => {
      const release = group.by.release?.toString() ?? '';
      if (!releaseGroups.has(release)) {
        releaseGroups.set(release, []);
        const groups = sessionsData.groups.filter(
          g => g.by.release?.toString() === release
        );
        const totalSessions = groups.reduce(
          (acc, g) => acc + (g.totals['sum(session)'] ?? 0),
          0
        );
        // Only add releases with sessions > 0
        if (totalSessions > 0) {
          releaseAdoption.set(release, percent(totalSessions, projTotal));
        }
      }
      // Only collect groups for releases with sessions
      if (releaseAdoption.has(release)) {
        releaseGroups.get(release)!.push(group);
      }
    });

    // Get top 5 releases and calculate their healthy session percentages
    const releases = Array.from(releaseAdoption.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([release]) => release);

    const series = releases.map(release => {
      const groups = releaseGroups.get(release)!;
      const getStatusSeries = (status: string) =>
        groups.find(g => g.by['session.status'] === status)?.series['sum(session)'] ?? [];

      // Get all status series at once
      const seriesData = getStatusSeries('healthy').map((healthy, idx) => {
        const total = [
          healthy,
          getStatusSeries('abnormal')[idx] || 0,
          getStatusSeries('crashed')[idx] || 0,
          getStatusSeries('errored')[idx] || 0,
        ].reduce((sum, val) => sum + val, 0);

        return {
          name: sessionsData.intervals[idx] ?? '',
          value: total > 0 ? healthy / total : 1,
        };
      });

      return {
        data: seriesData,
        seriesName: `successful_session_rate_${release}`,
        meta: {
          fields: {
            [`successful_session_rate_${release}`]: 'percentage' as const,
            time: 'date' as const,
          },
          units: {
            [`successful_session_rate_${release}`]: '%',
          },
        },
      };
    });

    return {series, releases, isPending, error};
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
