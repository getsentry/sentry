import {pageFiltersToQueryParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {SessionApiResponse} from 'sentry/types/organization';
import {percent} from 'sentry/utils';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {getSessionsInterval} from 'sentry/utils/sessions';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useSessionProjectTotal from 'sentry/views/insights/sessions/queries/useSessionProjectTotal';
import {getSessionStatusSeries} from 'sentry/views/insights/sessions/utils/sessions';

export default function useCrashFreeSessions({pageFilters}: {pageFilters?: PageFilters}) {
  const organization = useOrganization();
  const {selection: defaultPageFilters} = usePageFilters();

  const {
    data: sessionData,
    isPending,
    error,
  } = useApiQuery<SessionApiResponse>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/sessions/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          ...pageFiltersToQueryParams(pageFilters || defaultPageFilters),
          interval: getSessionsInterval(
            pageFilters ? pageFilters.datetime : defaultPageFilters.datetime
          ),
          field: ['sum(session)'],
          groupBy: ['session.status', 'release'],
        },
      },
    ],
    {staleTime: 0}
  );

  const projectTotal = useSessionProjectTotal({pageFilters});

  if (isPending || !sessionData) {
    return {
      series: [],
      isPending,
      error,
    };
  }

  // No data to report, just map the intervals to a value of 0
  if (!sessionData.groups.length) {
    return {
      series: [
        {
          seriesName: 'crash_free_session_rate',
          data: sessionData.intervals.map(interval => ({
            name: interval,
            value: 0,
          })),
          meta: {
            fields: {
              [`crash_free_session_rate`]: 'percentage' as const,
              time: 'date' as const,
            },
            units: {},
          },
        },
      ],
      isPending,
      error,
    };
  }

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

  // Get top 5 releases based on highest adoption rate (most sessions out of the project total)
  const topReleases = Array.from(releaseAdoptionMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([release]) => release);

  const series = topReleases.map(release => {
    const groups = releaseGroupMap.get(release)!;

    // Get all status series at once and calculate crash-free session percentage for each interval
    const seriesData = getSessionStatusSeries('crashed', groups).map(
      (crashedCount, idx) => {
        const intervalTotal = [
          crashedCount,
          getSessionStatusSeries('abnormal', groups)[idx] || 0,
          getSessionStatusSeries('crashed', groups)[idx] || 0,
          getSessionStatusSeries('unhandled', groups)[idx] || 0,
          getSessionStatusSeries('healthy', groups)[idx] || 0,
        ].reduce((sum, val) => sum + val, 0);

        return {
          name: sessionData.intervals[idx] ?? '',
          value: intervalTotal > 0 ? 1 - crashedCount / intervalTotal : 1,
        };
      }
    );

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
