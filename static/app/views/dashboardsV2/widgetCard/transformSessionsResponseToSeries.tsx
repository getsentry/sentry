import {MetricsApiResponse, SessionApiResponse} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';

const PATTERN = /count_(abnormal|errored|crashed|healthy)\((user|session)\)/;

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
  response: SessionApiResponse | MetricsApiResponse | null,
  requestedStatusMetrics: string[],
  queryAlias?: string
): Series[] {
  if (response === null) {
    return [];
  }

  const results: Series[] = [];

  response.groups.forEach(group => {
    Object.keys(group.series).forEach(field => {
      results.push({
        seriesName: getSeriesName(field, group, queryAlias),
        data: response.intervals.map((interval, index) => ({
          name: interval,
          value: group.series[field][index] ?? 0,
        })),
      });
    });
    if (requestedStatusMetrics.length && defined(group.by['session.status'])) {
      requestedStatusMetrics.forEach(status => {
        const result = status.match(PATTERN);
        if (result) {
          if (group.by['session.status'] === result[1]) {
            if (result[2] === 'session') {
              results.push({
                seriesName: getSeriesName(status, group, queryAlias),
                data: response.intervals.map((interval, index) => ({
                  name: interval,
                  value: group.series['sum(session)'][index] ?? 0,
                })),
              });
            } else if (result[2] === 'user') {
              results.push({
                seriesName: getSeriesName(status, group, queryAlias),
                data: response.intervals.map((interval, index) => ({
                  name: interval,
                  value: group.series['count_unique(user)'][index] ?? 0,
                })),
              });
            }
          } else {
            results.push({
              seriesName: getSeriesName(status, group, queryAlias),
              data: response.intervals.map(interval => ({
                name: interval,
                value: 0,
              })),
            });
          }
        }
      });
    }
  });

  // results = response.groups.flatMap(group =>
  //   Object.keys(group.series).map(field => ({
  //     seriesName: getSeriesName(field, group, queryAlias),
  //     data: response.intervals.map((interval, index) => ({
  //       name: interval,
  //       value: group.series[field][index] ?? 0,
  //     })),
  //   }))
  // );

  return results;
}
