import {SessionApiResponse} from 'sentry/types';
import {Series} from 'sentry/types/echarts';

export function transformSessionsResponseToSeries(
  response: SessionApiResponse | null,
  queryAlias?: string
): Series[] {
  function getSeriesName(field: string, group: SessionApiResponse['groups'][number]) {
    const groupName = Object.entries(group.by)
      .map(([_, value]) => `${value}`)
      .join(', ');
    const seriesName = groupName ? `${groupName} : ${field}` : field;
    return `${queryAlias ? `${queryAlias} > ` : ''}${seriesName}`;
  }
  return (
    response?.groups.flatMap(group =>
      Object.keys(group.series).map(field => ({
        seriesName: getSeriesName(field, group),
        data: response.intervals.map((interval, index) => ({
          name: interval,
          value: group.series[field][index] ?? 0,
        })),
      }))
    ) ?? []
  );
}
