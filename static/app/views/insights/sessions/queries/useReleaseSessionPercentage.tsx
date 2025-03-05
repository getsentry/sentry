import type {SessionApiResponse} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export default function useReleaseSessionPercentage() {
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
          groupBy: ['release'],
          per_page: 5,
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

  // Maps release to its API response groups
  const releaseGroupMap = new Map<string, typeof sessionData.groups>();

  sessionData.groups.forEach(group => {
    const release = group.by.release?.toString() ?? '';
    if (!releaseGroupMap.has(release)) {
      releaseGroupMap.set(release, []);
    }
    releaseGroupMap.get(release)!.push(group);
  });

  const series = Array.from(releaseGroupMap.keys()).map(release => {
    const groups = releaseGroupMap.get(release)!;

    // Calculate percentages for each interval
    const seriesData = sessionData.intervals.map((interval, idx) => {
      // Calculate total sessions for this release in this interval
      const releaseTotal = groups.reduce(
        (acc, group) => acc + (group.series['sum(session)']?.[idx] ?? 0),
        0
      );

      // Calculate total sessions across all releases for this interval
      const intervalTotal = Array.from(releaseGroupMap.values()).reduce(
        (acc, releaseGroups) =>
          acc +
          releaseGroups.reduce(
            (groupAcc, group) => groupAcc + (group.series['sum(session)']?.[idx] ?? 0),
            0
          ),
        0
      );

      const percentage = intervalTotal > 0 ? releaseTotal / intervalTotal : 0;

      return {
        name: interval ?? '',
        value: percentage,
      };
    });

    return {
      data: seriesData,
      seriesName: `${release}_session_percent`,
      meta: {
        fields: {
          [`${release}_session_percent`]: 'percentage' as const,
          time: 'date' as const,
        },
        units: {
          [`${release}_session_percent`]: '%',
        },
      },
    };
  });

  return {series, releases: Array.from(releaseGroupMap.keys()), isPending, error};
}
