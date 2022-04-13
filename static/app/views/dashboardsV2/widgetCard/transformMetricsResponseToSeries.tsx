import {SessionApiResponse} from 'sentry/types';
import {Series} from 'sentry/types/echarts';

export function transformSessionsResponseToSeries(
  response: SessionApiResponse | null,
  queryAlias?: string
): Series[] {
  return (
    response?.groups.flatMap(group =>
      Object.keys(group.series).map(field => ({
        seriesName: `${queryAlias ? `${queryAlias}: ` : ''}${field}${Object.entries(
          group.by
        )
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
