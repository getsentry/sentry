import {useCallback, useMemo} from 'react';
import type {UseQueryResult} from '@tanstack/react-query';
import chunk from 'lodash/chunk';

import type {ApiResult} from 'sentry/api';
import {DEFAULT_RELEASES_SORT, ReleasesSortOption} from 'sentry/constants/releases';
import type {Release} from 'sentry/types/release';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  fetchDataQuery,
  useApiQuery,
  useQueries,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
import {escapeFilterValue} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type ReleaseWithCount = Release & {
  count?: number;
};

// Maximum releases per event count query to avoid overly long query strings
const RELEASES_PER_CHUNK = 10;

/**
 * Hook to fetch releases for dashboard filtering.
 *
 * Fetches releases from the releases API and optionally enriches them with
 * event counts from the spans dataset. Event counts are lazy-loaded only
 * when the dropdown is open to reduce API calls.
 *
 * @param searchTerm - Filter releases by version name
 * @param sortBy - Sort order for releases (date, sessions, users, etc.)
 * @param eventCountsEnabled - Whether to fetch event counts (enables lazy loading)
 *
 * @tested_via ReleasesSelectControl component tests (releasesSelectControl.spec.tsx)
 */
export function useReleases(
  searchTerm: string,
  sortBy: ReleasesSortOption,
  eventCountsEnabled = false
): {
  data: ReleaseWithCount[];
  isLoading: boolean;
} {
  const organization = useOrganization();
  const {selection, isReady} = usePageFilters();
  const {environments, projects, datetime} = selection;

  // Normalize sort option: ADOPTION requires exactly one environment because it
  // calculates the percentage of sessions/users in that specific environment.
  // Reset to default if the requirement isn't met.
  const activeSort =
    sortBy === ReleasesSortOption.ADOPTION && environments.length !== 1
      ? DEFAULT_RELEASES_SORT
      : (sortBy ?? DEFAULT_RELEASES_SORT);

  // Fetch releases
  const releaseResults = useApiQuery<Release[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/releases/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          project: projects,
          per_page: 50,
          environment: environments,
          query: searchTerm,
          sort: activeSort,
          // flatten=1 groups releases across projects when sorting by non-date fields,
          // flatten=0 keeps releases separate per project for date sorting
          flatten: activeSort === ReleasesSortOption.DATE ? 0 : 1,
        },
      },
    ],
    {
      staleTime: Infinity,
      enabled: isReady,
      retry: false,
    }
  );

  const allReleases = useMemo(() => releaseResults.data ?? [], [releaseResults.data]);

  const chunks = useMemo(
    () => (allReleases.length ? chunk(allReleases, RELEASES_PER_CHUNK) : []),
    [allReleases]
  );

  // Combine function for useQueries - extracts metrics stats from query results.
  // Wrapped in useCallback to maintain referential stability.
  // The result is structurally shared by TanStack Query, so it won't change
  // reference unless the underlying data changes.
  const combineMetricsResults = useCallback(
    (results: Array<UseQueryResult<ApiResult<TableData>, Error>>) => {
      const isFetched = results.every(result => result.isFetched);
      if (!isFetched) {
        return {metricsStats: {}, metricsFetched: false};
      }
      const stats: Record<string, {count: number}> = {};
      results.forEach(result =>
        result.data?.[0]?.data?.forEach(row => {
          const releaseVersion = row.release;
          if (typeof releaseVersion === 'string') {
            stats[releaseVersion] = {count: row['count()'] as number};
          }
        })
      );
      return {metricsStats: stats, metricsFetched: true};
    },
    []
  );

  const {metricsStats, metricsFetched} = useQueries({
    queries: chunks.map(releaseChunk => {
      const queryKey: ApiQueryKey = [
        getApiUrl('/organizations/$organizationIdOrSlug/events/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        {
          query: {
            field: ['release', 'count()'],
            query: `release:[${releaseChunk.map(r => `"${escapeFilterValue(r.version)}"`).join(',')}]`,
            dataset: DiscoverDatasets.SPANS,
            project: projects,
            environment: environments,
            start: datetime.start,
            end: datetime.end,
            statsPeriod: datetime.period,
            referrer: 'api.dashboards-release-selector',
          },
        },
      ];
      return {
        queryKey,
        queryFn: fetchDataQuery<TableData>,
        staleTime: Infinity,
        enabled: isReady && !releaseResults.isPending && eventCountsEnabled,
        retry: false,
      };
    }),
    combine: combineMetricsResults,
  });

  // Enrich releases with event counts
  const enrichedReleases: ReleaseWithCount[] = useMemo(() => {
    if (!metricsFetched) {
      return allReleases;
    }
    return allReleases.map(release => ({
      ...release,
      count: metricsStats[release.version]?.count,
    }));
  }, [allReleases, metricsFetched, metricsStats]);

  return {
    data: enrichedReleases,
    isLoading: releaseResults.isPending || (eventCountsEnabled && !metricsFetched),
  };
}
