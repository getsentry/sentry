import {MetricsApiResponse} from 'sentry/types';
import {Series} from 'sentry/types/echarts';

export function transformMetricsResponseToSeries(
  response: MetricsApiResponse | null,
  queryAlias?: string
): Series[] {
  return (
    response?.groups.flatMap(group => {
      if (group.series === undefined) {
        return [];
      }
      return Object.keys(group.series).map(field => ({
        seriesName: `${queryAlias ? `${queryAlias}: ` : ''}${field}${Object.entries(
          group.by
        )
          .map(([key, value]) => `|${key}:${value}`)
          .join('')}`,
        data: response.intervals.map((interval, index) => ({
          name: interval,
          value: group.series ? group.series[field][index] ?? 0 : 0,
        })),
      }));
    }) ?? []
  );
}
