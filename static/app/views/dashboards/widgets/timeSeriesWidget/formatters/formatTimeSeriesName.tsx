import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

export function formatTimeSeriesName(timeSeries: TimeSeries): string {
  let name = `${timeSeries.yAxis}`;

  if (timeSeries.groupBy?.length) {
    name += ` : ${timeSeries.groupBy
      ?.map(groupBy => {
        return `${groupBy.key} : ${groupBy.value}`;
      })
      .join(',')}`;
  }

  return name;
}
