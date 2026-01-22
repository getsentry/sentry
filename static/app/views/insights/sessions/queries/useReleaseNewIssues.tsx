import {getInterval} from 'sentry/components/charts/utils';
import {pageFiltersToQueryParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {IssuesMetricsApiResponse} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export default function useReleaseNewIssues({pageFilters}: {pageFilters?: PageFilters}) {
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
          category: 'issue',
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

  const createSeries = (timeseriesData: (typeof issueData.timeseries)[0]) => {
    const releaseName = timeseriesData.groupBy[0] || 'unknown';
    return {
      data: timeseriesData.values.map(v => ({
        name: new Date(v.timestamp * 1000).toISOString(),
        value: v.value,
      })),
      seriesName: releaseName,
      meta: {
        fields: {
          [releaseName]: 'integer' as const,
          time: 'date' as const,
        },
        units: {},
        order: timeseriesData.meta.order,
        isOther: timeseriesData.meta.isOther,
      },
    };
  };

  return {
    series: issueData.timeseries
      .filter(t => t.axis === 'new_issues_count_by_release')
      .map(createSeries),
    isPending,
    error,
  };
}
