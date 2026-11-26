import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

// ECharts stacks series on a time axis by data index, not by timestamp.
export function alignTimeSeries(
  series: Array<TimeSeries | undefined>
): Array<TimeSeries | undefined> {
  const timestamps = [
    ...new Set(series.flatMap(item => item?.values.map(value => value.timestamp) ?? [])),
  ].sort((a, b) => a - b);

  return series.map(item => {
    if (!item) {
      return item;
    }
    const valuesByTimestamp = new Map(item.values.map(value => [value.timestamp, value]));
    return {
      ...item,
      values: timestamps.map(
        timestamp => valuesByTimestamp.get(timestamp) ?? {timestamp, value: null}
      ),
    };
  });
}
