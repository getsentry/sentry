import {pageFiltersToQueryParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {SessionApiResponse} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {getSessionsInterval} from 'sentry/utils/sessions';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export default function useReleaseSessionPercentage({
  pageFilters,
}: {
  pageFilters?: PageFilters;
}) {
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

  // No data to report, just map the intervals to a value of 0
  if (!sessionData.groups.length) {
    return {
      series: [
        {
          seriesName: 'session_percent',
          data: sessionData.intervals.map(interval => ({
            name: interval,
            value: 0,
          })),
          meta: {
            fields: {
              [`session_percent`]: 'percentage' as const,
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

  return {
    series,
    releases: Array.from(releaseGroupMap.keys()),
    isPending,
    error,
  };
}
