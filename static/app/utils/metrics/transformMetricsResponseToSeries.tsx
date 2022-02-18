import {MetricsApiResponse} from 'sentry/types';
import {Series} from 'sentry/types/echarts';

export function transformMetricsResponseToSeries(
  response: MetricsApiResponse | null
): Series[] {
  return (
    response?.groups.flatMap(group =>
      Object.keys(group.series).map(field => ({
        seriesName: `${field}${Object.entries(group.by)
          .map(([key, value]) => `|${key}:${value}`)
          .join('')}`,
        data: response.intervals.map((interval, index) => ({
          name: interval,
          value: group.series[field][index] ?? 0,
        })),
      }))
    ) ?? []
  );
}
