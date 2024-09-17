import {getInterval} from 'sentry/components/charts/utils';
import type {Group} from 'sentry/types/group';
import type {MultiSeriesEventsStats} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getPeriod} from 'sentry/utils/duration/getPeriod';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

interface UseFetchEventStatsParameters {
  group: Group;
  referrer: string;
  query?: string;
}

export function useFetchEventStatsQuery({
  group,
  query,
  referrer,
}: UseFetchEventStatsParameters) {
  const {selection: pageFilters} = usePageFilters();
  const periodQuery = getPeriod(pageFilters.datetime);
  const interval = getInterval(pageFilters.datetime, 'low');
  const config = getConfigForIssueType(group, group.project);
  const fullQuery = {
    ...periodQuery,
    interval,
    referrer,
    environment: pageFilters.environments,
    yAxis: ['count()', 'count_unique(user)'],
    dataset: config.usesIssuePlatform
      ? DiscoverDatasets.ISSUE_PLATFORM
      : DiscoverDatasets.ERRORS,
    project: Number(group.project.id),
    query: `${query} issue:${group.shortId}`,
  };
  return fullQuery;
}

function makeFetchEventStatsQueryKey({
  organizationSlug,
  query,
}: {
  organizationSlug: string;
  query: Record<string, any>;
}): ApiQueryKey {
  return [`/organizations/${organizationSlug}/events-stats/`, {query}];
}

export function useFetchEventStats({
  params: {group, query, referrer},
  options,
}: {
  params: UseFetchEventStatsParameters;
  options?: UseApiQueryOptions<MultiSeriesEventsStats>;
}) {
  const organization = useOrganization();
  const fullQuery = useFetchEventStatsQuery({group, query, referrer});
  const queryKey = makeFetchEventStatsQueryKey({
    organizationSlug: organization.slug,
    query: fullQuery,
  });

  return useApiQuery<MultiSeriesEventsStats>(queryKey, {
    staleTime: 30000,
    retry: false,
    ...options,
  });
}
