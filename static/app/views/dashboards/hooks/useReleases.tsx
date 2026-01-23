import {useCallback, useMemo} from 'react';
import chunk from 'lodash/chunk';

import {ReleasesSortOption, type ReleasesSortByOption} from 'sentry/constants/releases';
import type {NewQuery} from 'sentry/types/organization';
import type {Release} from 'sentry/types/release';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  fetchDataQuery,
  useApiQuery,
  useQueries,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
import {escapeFilterValue} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export type ReleaseWithCount = Release & {
  count?: number;
};

export function useReleases(
  searchTerm: string,
  sortBy: ReleasesSortByOption
): {
  data: ReleaseWithCount[];
  isLoading: boolean;
  onSearch: (search: string) => void;
} {
  const organization = useOrganization();
  const location = useLocation();
  const {selection, isReady} = usePageFilters();
  const {environments, projects} = selection;

  const activeSort = sortBy ?? ReleasesSortOption.DATE;

  // Fetch releases - use getApiUrl from master
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
      const newQuery: NewQuery = {
        name: '',
        fields: ['release', 'count()'],
        query: escapeFilterValue(
          `release:[${releaseChunk.map(r => `"${r.version}"`).join()}]`
        ),
        dataset: DiscoverDatasets.SPANS,
        version: 2,
        projects: selection.projects,
      };
      const eventView = EventView.fromNewQueryWithPageFilters(newQuery, selection);
      const queryKey: ApiQueryKey = [
        `/organizations/${organization.slug}/events/`,
        {
          query: {
            ...eventView.getEventsAPIPayload(location),
            referrer: 'api.dashboards-release-selector',
          },
        },
      ];
      return {
        queryKey,
        queryFn: fetchDataQuery<TableData>,
        staleTime: Infinity,
        enabled: isReady && !releaseResults.isPending,
        retry: false,
      };
    }),
  });

  const metricsFetched = releaseMetrics.every(result => result.isFetched);

  // Extract data from releaseMetrics for stable reference
  const metricsData = useMemo(
    () => releaseMetrics.map(result => result.data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metricsFetched]
  );

  // Create a map of release version to event counts
  const metricsStats: Record<string, {count: number}> = useMemo(() => {
    if (!metricsFetched) {
      return {};
    }
    const stats: Record<string, {count: number}> = {};
    metricsData.forEach(data =>
      data?.[0]?.data?.forEach(release => {
        stats[release.release!] = {count: release['count()'] as number};
      })
    );
    return stats;
  }, [metricsFetched, metricsData]);

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

  const onSearch = useCallback(() => {
    // Search is handled by updating the searchTerm parameter
    // which will trigger a new query
  }, []);

  return {
    data: enrichedReleases,
    isLoading: !metricsFetched || releaseResults.isPending,
    onSearch,
  };
}
