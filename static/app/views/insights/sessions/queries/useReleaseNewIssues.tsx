import {getInterval} from 'sentry/components/charts/utils';
import type {IssuesMetricsApiResponse} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export default function useReleaseNewIssues() {
  const location = useLocation();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const locationQuery = {
    ...location,
    query: {
      ...location.query,
      query: undefined,
      width: undefined,
      cursor: undefined,
    },
  };

  const {
    data: issueData,
    isPending,
    error,
  } = useApiQuery<IssuesMetricsApiResponse>(
    [
      `/organizations/${organization.slug}/issues-metrics/`,
      {
        query: {
          ...locationQuery.query,
          category: 'issue',
          interval: getInterval(selection.datetime, 'issues-metrics'),
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
