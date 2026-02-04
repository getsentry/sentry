import {pageFiltersToQueryParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {SessionApiResponse} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {getSessionsInterval} from 'sentry/utils/sessions';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export default function useReleaseSessionCounts({
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
          seriesName: 'total_sessions',
          data: sessionData.intervals.map(interval => ({
            name: interval,
            value: 0,
          })),
          meta: {
            fields: {
              [`total_sessions`]: 'integer' as const,
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
