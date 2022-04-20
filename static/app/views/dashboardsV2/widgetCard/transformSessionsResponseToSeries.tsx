import {SessionApiResponse} from 'sentry/types';
import {Series} from 'sentry/types/echarts';

function getSeriesName(
  field: string,
  group: SessionApiResponse['groups'][number],
  queryAlias?: string
) {
  const groupName = Object.entries(group.by)
    .map(([_, value]) => `${value}`)
    .join(', ');
  const seriesName = groupName ? `${groupName} : ${field}` : field;
  return `${queryAlias ? `${queryAlias} > ` : ''}${seriesName}`;
}

export function transformSessionsResponseToSeries(
  response: SessionApiResponse | null,
  limit?: number,
  queryAlias?: string
): Series[] {
  if (response === null) {
    return [];
  }
  // Temporarily restrict the number of lines we plot on grouped queries
  const groups: SessionApiResponse['groups'] = limit
    ? response.groups.slice(0, limit)
    : response.groups;
  return groups.flatMap(group =>
    Object.keys(group.series).map(field => ({
      seriesName: getSeriesName(field, group, queryAlias),
      data: response.intervals.map((interval, index) => ({
        name: interval,
        value: group.series[field][index] ?? 0,
      })),
    }))
  );
}
