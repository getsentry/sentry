import {getInterval} from 'sentry/components/charts/utils';
import {pageFiltersToQueryParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {IssuesMetricsApiResponse} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export default function useNewAndResolvedIssues({
  type,
  pageFilters,
}: {
  type: 'issue' | 'feedback';
  pageFilters?: PageFilters;
}) {
  const organization = useOrganization();
  const {selection: defaultPageFilters} = usePageFilters();

  const {
    data: issueData,
    isPending,
    error,
  } = useApiQuery<IssuesMetricsApiResponse>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/issues-metrics/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          ...pageFiltersToQueryParams(pageFilters || defaultPageFilters),
          category: type,
          interval: getInterval(
            pageFilters ? pageFilters.datetime : defaultPageFilters.datetime,
            'issues-metrics'
          ),
        },
      },
    ],
    {staleTime: 0}
  );

  if (isPending || !issueData) {
    return {
      series: [],
      isPending,
      error,
    };
  }

  const createSeries = (axisName: string) => ({
    data: issueData.timeseries
      .filter(t => t.axis === axisName)
      .flatMap(t =>
        t.values.map(v => ({
          name: new Date(v.timestamp * 1000).toISOString(),
          value: v.value,
        }))
      ),
    seriesName: axisName,
    meta: {
      fields: {
        [axisName]: 'integer' as const,
        time: 'date' as const,
      },
      units: {},
    },
  });

  return {
    series: [createSeries('new_issues_count'), createSeries('resolved_issues_count')],
    isPending,
    error,
  };
}
