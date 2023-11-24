import chunk from 'lodash/chunk';

import {NewQuery, Release} from 'sentry/types';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {ApiQueryKey, useApiQuery, useQueries} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {escapeFilterValue} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export function useReleases(searchTerm?: string) {
  const organization = useOrganization();
  const location = useLocation();
  const {selection, isReady} = usePageFilters();
  const {environments, projects} = selection;
  const api = useApi();

  const releaseResults = useApiQuery<Release[]>(
    [
      `/organizations/${organization.slug}/releases/`,
      {
        query: {
          project: projects,
          per_page: 50,
          environment: environments,
          query: searchTerm,
          sort: 'date',
        },
      },
    ],
    {staleTime: Infinity, enabled: isReady}
  );

  const chunks =
    releaseResults.data && releaseResults.data.length
      ? chunk(releaseResults.data, 10)
      : [];

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
        ...{staleTime: Infinity, enabled: isReady && !releaseResults.isLoading},
      };
    }),
  });

  const metricsFetched = releaseMetrics.every(result => result.isFetched);

  const metricsStats: {[version: string]: {count: number}} = {};
  if (metricsFetched) {
    releaseMetrics.forEach(
      c =>
        c.data?.data?.forEach(release => {
          metricsStats[release.release] = {count: release['count()'] as number};
        })
    );
  }

  const releaseStats: {
    dateCreated: string;
    version: string;
    count?: number;
  }[] =
    releaseResults.data && releaseResults.data.length && metricsFetched
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
    isLoading: !metricsFetched || releaseResults.isLoading,
  };
}

export function useReleaseSelection(): {
  isLoading: boolean;
  primaryRelease: string | undefined;
  secondaryRelease: string | undefined;
} {
  const location = useLocation();

  const {data: releases, isLoading} = useReleases();
  const primaryRelease =
    decodeScalar(location.query.primaryRelease) ?? releases?.[0]?.version ?? undefined;

  const secondaryRelease =
    decodeScalar(location.query.secondaryRelease) ??
    (releases && releases.length > 1 ? releases?.[1]?.version : undefined);

  return {primaryRelease, secondaryRelease, isLoading};
}
