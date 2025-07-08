import type {Series} from 'sentry/types/echarts';
import type {SessionApiResponse} from 'sentry/types/organization';
import getDuration from 'sentry/utils/duration/getDuration';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
// Import the field mapping from dashboard config
import {FIELD_TO_METRICS_EXPRESSION} from 'sentry/views/dashboards/widgetBuilder/releaseWidget/fields';
import type {DetectorSeriesQueryOptions} from 'sentry/views/detectors/datasetConfig/base';

/**
 * Transform field names to metrics API field names
 * Based on dashboard fieldsToDerivedMetrics function
 */
function fieldsToDerivedMetrics(field: string): string {
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return FIELD_TO_METRICS_EXPRESSION[field] ?? field;
}

/**
 * Transform SessionApiResponse into Series format for AreaChart
 * Based on dashboards transformSessionsResponseToSeries function
 */
export function transformMetricsResponseToSeries(
  data: SessionApiResponse | undefined | null,
  aggregate: string
): Series {
  const field = fieldsToDerivedMetrics(aggregate);
  if (!data?.intervals) {
    return {
      seriesName: field,
      data: [],
    };
  }

  return {
    seriesName: field,
    data: data.intervals.map((interval, index) => {
      return {
        name: new Date(interval).getTime(), // Convert string to milliseconds
        value: data.groups.reduce((acc, group) => {
          const value = group.series?.[field]?.[index] ?? 0;
          return acc + value;
        }, 0),
      };
    }),
  };
}

export function getReleasesSeriesQueryOptions({
  aggregate,
  environment,
  interval,
  organization,
  projectId,
  query,
}: DetectorSeriesQueryOptions): ApiQueryKey {
  const field = fieldsToDerivedMetrics(aggregate);
  return [
    `/organizations/${organization.slug}/metrics/data/`,
    {
      query: {
        field: [field],
        includeSeries: 1,
        includeTotals: 0,
        interval: getDuration(interval, 0, false, true),
        orderBy: field,
        per_page: 1,
        project: [projectId],
        statsPeriod: '7d',
        ...(environment && {environment: [environment]}),
        ...(query && {query}),
      },
    },
  ];
}
