import {NewQuery, Release} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';

export function useReleases(searchTerm?: string) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const {environments, projects} = selection;

  const releaseResults = useApiQuery<Release[]>(
    [
      `/organizations/${organization.slug}/releases/`,
      {
        query: {
          project: projects,
          per_page: 100,
          environment: environments,
          query: searchTerm,
          sort: 'date',
        },
      },
    ],
    {staleTime: Infinity}
  );

  const newQuery: NewQuery = {
    name: '',
    fields: ['release', 'count()'],
    query: `transaction.op:ui.load ${searchTerm ? `release:*${searchTerm}*` : ''}`,
    dataset: DiscoverDatasets.METRICS,
    version: 2,
    projects: selection.projects,
  };
  const eventView = EventView.fromNewQueryWithPageFilters(newQuery, selection);
  const {data: metricsResult, isLoading: isMetricsStatsLoading} = useTableQuery({
    eventView,
    limit: 250,
    staleTime: Infinity,
  });

  const metricsStats: {[version: string]: {count: number}} = {};
  metricsResult?.data?.forEach(release => {
    metricsStats[release.release] = {count: release['count()'] as number};
  });

  const releaseStats: {
    dateCreated: string;
    version: string;
    count?: number;
  }[] =
    releaseResults.data && releaseResults.data.length && !isMetricsStatsLoading
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
  };
}

export function useReleaseSelection() {
  const location = useLocation();

  const {data: releases, isLoading} = useReleases();
  const primaryRelease =
    decodeScalar(location.query.primaryRelease) ?? releases?.[0]?.version ?? undefined;

  const secondaryRelease =
    decodeScalar(location.query.secondaryRelease) ??
    (releases && releases.length > 1 ? releases?.[1]?.version : undefined);

  return {primaryRelease, secondaryRelease, isLoading};
}
