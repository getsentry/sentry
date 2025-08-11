import type {Series} from 'sentry/types/echarts';
import type {SessionApiResponse} from 'sentry/types/organization';
import getDuration from 'sentry/utils/duration/getDuration';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
// Import the field mapping from dashboard config
import {FIELD_TO_METRICS_EXPRESSION} from 'sentry/views/dashboards/widgetBuilder/releaseWidget/fields';
import type {DetectorSeriesQueryOptions} from 'sentry/views/detectors/datasetConfig/base';

function fieldsToDerivedMetrics(field: string): string {
  return (
    FIELD_TO_METRICS_EXPRESSION[field as keyof typeof FIELD_TO_METRICS_EXPRESSION] ??
    field
  );
}

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
    data: data.intervals.map((interval: string, index: number) => {
      return {
        name: new Date(interval).getTime(),
        value: data.groups.reduce((acc: number, group) => {
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
  statsPeriod,
  comparisonDelta,
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
        statsPeriod,
        ...(environment && {environment: [environment]}),
        ...(query && {query}),
        ...(comparisonDelta && {comparisonDelta}),
      },
    },
  ];
}
