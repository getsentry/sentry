import type {SessionApiResponse} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export default function useReleaseSessionCounts() {
  const location = useLocation();
  const organization = useOrganization();

  const locationQuery = {
    ...location,
    query: {
      ...location.query,
      width: undefined,
      cursor: undefined,
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
          ...locationQuery.query,
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

  const releaseKeys = Array.from(releaseGroupMap.keys());

  const series = releaseKeys.map(release => {
    const groups = releaseGroupMap.get(release)!;

    // Calculate total sessions for each interval
    const seriesData = sessionData.intervals.map((interval, idx) => {
      const intervalTotal = groups.reduce(
        (acc, group) => acc + (group.series['sum(session)']?.[idx] ?? 0),
        0
      );

      return {
        name: interval ?? '',
        value: intervalTotal,
      };
    });

    return {
      data: seriesData,
      seriesName: `${release}_total_sessions`,
      meta: {
        fields: {
          [`${release}_total_sessions`]: 'integer' as const,
          time: 'date' as const,
        },
        units: {},
      },
    };
  });

  return {series, releases: releaseKeys, isPending, error};
}
