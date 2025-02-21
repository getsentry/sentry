import type {SessionApiResponse} from 'sentry/types/organization';
import {percent} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useSessionAdoptionRate from 'sentry/views/insights/sessions/queries/useSessionProjectTotal';

export default function useCrashFreeSessions() {
  const location = useLocation();
  const organization = useOrganization();

  const locationWithoutWidth = {
    ...location,
    query: {...location.query, width: undefined},
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
          groupBy: ['session.status', 'release'],
        },
      },
    ],
    {staleTime: 0}
  );

  const projectTotal = useSessionAdoptionRate();

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

  // Maps release to its API response groups
  const releaseGroupMap = new Map<string, typeof sessionData.groups>();

  // Maps release to its adoption rate calculation
  const releaseAdoptionMap = new Map<string, number>();

  sessionData.groups.forEach(group => {
    const release = group.by.release?.toString() ?? '';
    if (!releaseGroupMap.has(release)) {
      releaseGroupMap.set(release, []);
      const releaseGroups = sessionData.groups.filter(
        g => g.by.release?.toString() === release
      );

      // Calculate total sessions for entire time period
      const totalSessionCount = releaseGroups.reduce(
        (acc, g) => acc + (g.totals['sum(session)'] ?? 0),
        0
      );

      // Only consider releases with total sessions > 0
      if (totalSessionCount > 0) {
        releaseAdoptionMap.set(release, percent(totalSessionCount, projectTotal));
      }
    }
    if (releaseAdoptionMap.has(release)) {
      releaseGroupMap.get(release)!.push(group);
    }
  });

  // Get top 5 releases
  const topReleases = Array.from(releaseAdoptionMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([release]) => release);

  const series = topReleases.map(release => {
    const groups = releaseGroupMap.get(release)!;

    // Get all status series at once and calculate crash-free session percentage for each interval
    const seriesData = getStatusSeries('crashed', groups).map((crashedCount, idx) => {
      const intervalTotal = [
        crashedCount,
        getStatusSeries('abnormal', groups)[idx] || 0,
        getStatusSeries('crashed', groups)[idx] || 0,
        getStatusSeries('healthy', groups)[idx] || 0,
      ].reduce((sum, val) => sum + val, 0);

      return {
        name: sessionData.intervals[idx] ?? '',
        value: intervalTotal > 0 ? 1 - crashedCount / intervalTotal : 1,
      };
    });

    return {
      data: seriesData,
      seriesName: `crash_free_session_rate_${release}`,
      meta: {
        fields: {
          [`crash_free_session_rate_${release}`]: 'percentage' as const,
          time: 'date' as const,
        },
        units: {
          [`crash_free_session_rate_${release}`]: '%',
        },
      },
    };
  });

  return {series, releases: topReleases, isPending, error};
}
