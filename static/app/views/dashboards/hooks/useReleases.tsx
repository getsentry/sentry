import {useMemo} from 'react';
import chunk from 'lodash/chunk';

import {ReleasesSortOption} from 'sentry/constants/releases';
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

export type ReleaseWithCount = Release & {
  count?: number;
};

/**
 * Hook to fetch releases for dashboard filtering.
 *
 * This is similar to the Insights version (static/app/views/insights/common/queries/useReleases.tsx)
 * but simplified for general dashboard use - it doesn't include the mobile-specific metrics queries
 * that the Insights version uses for event counts.
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

  const activeSort = sortBy ?? ReleasesSortOption.DATE;

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

  // Fetch event counts for releases
  const chunks = useMemo(
    () => (allReleases.length ? chunk(allReleases, 10) : []),
    [allReleases]
  );
  const releaseMetrics = useQueries({
    queries: chunks.map(releaseChunk => {
      const queryKey: ApiQueryKey = [
        getApiUrl('/organizations/$organizationIdOrSlug/events/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        {
          query: {
            field: ['release', 'count()'],
            query: escapeFilterValue(
              `release:[${releaseChunk.map(r => `"${r.version}"`).join()}]`
            ),
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
  });

  const metricsFetched = releaseMetrics.every(result => result.isFetched);

  // Create a map of release version to event counts
  const metricsStats: Record<string, {count: number}> = useMemo(() => {
    if (!metricsFetched) {
      return {};
    }
    const stats: Record<string, {count: number}> = {};
    releaseMetrics.forEach(result =>
      result.data?.[0]?.data?.forEach(release => {
        stats[release.release!] = {count: release['count()'] as number};
      })
    );
    return stats;
    // We use metricsFetched (a boolean) and allReleases as dependencies.
    // metricsFetched triggers recomputation when queries complete.
    // allReleases ensures we recompute when the release list changes (e.g., sort changes),
    // which invalidates any cached metrics data from the previous release list.
    // We intentionally exclude releaseMetrics because useQueries returns an unstable
    // reference on every render - when metricsFetched becomes true, the query data
    // is available via the closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricsFetched, allReleases]);

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
