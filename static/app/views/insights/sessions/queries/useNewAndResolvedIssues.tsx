import {getInterval} from 'sentry/components/charts/utils';
import type {IssuesMetricsApiResponse} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export default function useNewAndResolvedIssues({type}: {type: 'error' | 'feedback'}) {
  const location = useLocation();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const locationQuery = {
    ...location,
    query: {
      ...location.query,
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
          category: type,
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
