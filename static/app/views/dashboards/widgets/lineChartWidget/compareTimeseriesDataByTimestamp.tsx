import type {TimeSeriesItem} from '../common/types';

export function compareTimeseriesDataByTimestamp(
  a: TimeSeriesItem,
  b: TimeSeriesItem
): number {
  if (a.timestamp > b.timestamp) {
    return 1;
  }

  if (a.timestamp < b.timestamp) {
    return -1;
  }

  return 0;
}
