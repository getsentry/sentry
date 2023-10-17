import {getInterval} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {Release} from 'sentry/types';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export function useReleases(searchTerm?: string) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const {environments, projects} = selection;

  return useApiQuery<Release[]>(
    [
      `/organizations/${organization.slug}/releases/`,
      {
        query: {
          sort: 'date',
          project: projects,
          per_page: 50,
          environment: environments,
          query: searchTerm,
        },
      },
    ],
    {staleTime: Infinity}
  );
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

export function useReleaseStats() {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const {environments, projects} = selection;

  const {start, end, statsPeriod} = normalizeDateTimeParams(selection.datetime, {
    allowEmptyPeriod: true,
  });

  // The sessions endpoint does not support wildcard search.
  // So we're just getting top 250 values ordered by count.
  // Hopefully this is enough to populate session count for
  // any releases searched in the release selector.
  const urlQuery = Object.fromEntries(
    Object.entries({
      project: projects,
      environment: environments,
      field: ['sum(session)'],
      groupBy: ['release', 'project'],
      orderBy: '-sum(session)',
      start,
      end,
      statsPeriod,
      per_page: 250,
      interval: getInterval({start, end, period: statsPeriod}, 'low'),
    }).filter(([, value]) => defined(value) && value !== '')
  );

  const result = useApiQuery<any>(
    [
      `/organizations/${organization.slug}/sessions/`,
      {
        query: urlQuery,
      },
    ],
    {staleTime: Infinity}
  );

  const releaseStatsMap: {[release: string]: {project: number; 'sum(session)': number}} =
    {};
  if (result.data && result.data.groups) {
    result.data.groups.forEach(group => {
      const release = group.by.release;
      const project = group.by.project;
      const sessionCount = group.totals['sum(session)'];

      releaseStatsMap[release] = {project, 'sum(session)': sessionCount};
    });
  }

  return {
    ...result,
    data: releaseStatsMap,
  };
}
