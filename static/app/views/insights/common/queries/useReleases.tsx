import chunk from 'lodash/chunk';

import {ReleasesSortOption} from 'sentry/constants/releases';
import type {NewQuery} from 'sentry/types/organization';
import type {Release} from 'sentry/types/release';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery, useQueries} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {escapeFilterValue} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {ReleasesSortByOption} from 'sentry/views/insights/common/components/releasesSort';

export function useReleases(
  searchTerm: string | undefined,
  sortBy: ReleasesSortByOption | undefined
) {
  const organization = useOrganization();
  const location = useLocation();
  const {selection, isReady} = usePageFilters();
  const {environments, projects} = selection;
  const api = useApi();

  const activeSort = sortBy ?? ReleasesSortOption.DATE;
  const releaseResults = useApiQuery<Release[]>(
    [
      `/organizations/${organization.slug}/releases/`,
      {
        query: {
          project: projects,
          per_page: 50,
          environment: environments,
          query: searchTerm,
          sort: activeSort,
          // Depending on the selected sortBy option, 'flatten' is needed or we get an error from the backend.
          // A similar logic can be found in https://github.com/getsentry/sentry/blob/6209d6fbf55839bb7a2f93ef65decbf495a64974/static/app/views/releases/list/index.tsx#L106
          flatten: activeSort === ReleasesSortOption.DATE ? 0 : 1,
        },
      },
    ],
    {staleTime: Infinity, enabled: isReady, retry: false}
  );

  const chunks = releaseResults.data?.length ? chunk(releaseResults.data, 10) : [];

  const releaseMetrics = useQueries({
    queries: chunks.map(releases => {
      const newQuery: NewQuery = {
        name: '',
        fields: ['release', 'count()'],
        query: `transaction.op:ui.load ${escapeFilterValue(
          `release:[${releases.map(r => `"${r.version}"`).join()}]`
        )}`,
        dataset: DiscoverDatasets.METRICS,
        version: 2,
        projects: selection.projects,
      };
      const eventView = EventView.fromNewQueryWithPageFilters(newQuery, selection);
      const queryKey = [
        `/organizations/${organization.slug}/events/`,
        {
          query: {
            ...eventView.getEventsAPIPayload(location),
            referrer: 'api.starfish.mobile-release-selector',
          },
        },
      ] as ApiQueryKey;
      return {
        queryKey,
        queryFn: () =>
          api.requestPromise(queryKey[0], {
            method: 'GET',
            query: queryKey[1]?.query,
          }) as Promise<TableData>,
        staleTime: Infinity,
        enabled: isReady && !releaseResults.isPending,
        retry: false,
      };
    }),
  });

  const metricsFetched = releaseMetrics.every(result => result.isFetched);

  const metricsStats: {[version: string]: {count: number}} = {};
  if (metricsFetched) {
    releaseMetrics.forEach(c =>
      c.data?.data?.forEach(release => {
        metricsStats[release.release!] = {count: release['count()'] as number};
      })
    );
  }

  const releaseStats: Array<{
    dateCreated: string;
    version: string;
    count?: number;
  }> =
    releaseResults.data?.length && metricsFetched
      ? releaseResults.data.flatMap(release => {
          const releaseVersion = release.version;
          const dateCreated = release.dateCreated;
          if (metricsStats[releaseVersion]?.count) {
            return {
              dateCreated,
              version: releaseVersion,
              count: metricsStats[releaseVersion]?.count,
            };
          }
          return [];
        })
      : [];

  return {
    ...releaseResults,
    data: releaseStats,
    isLoading: !metricsFetched || releaseResults.isPending,
  };
}

export function useReleaseSelection(): {
  isLoading: boolean;
  primaryRelease: string | undefined;
  secondaryRelease: string | undefined;
} {
  const location = useLocation();

  const {data: releases, isLoading} = useReleases(undefined, undefined);

  // If there are more than 1 release, the first one should be the older one
  const primaryRelease =
    decodeScalar(location.query.primaryRelease) ??
    (releases && releases.length > 1 ? releases?.[1]?.version : releases?.[0]?.version);

  // If there are more than 1 release, the second one should be the newest one
  const secondaryRelease =
    decodeScalar(location.query.secondaryRelease) ??
    (releases && releases.length > 1 ? releases?.[0]?.version : undefined);

  return {primaryRelease, secondaryRelease, isLoading};
}
