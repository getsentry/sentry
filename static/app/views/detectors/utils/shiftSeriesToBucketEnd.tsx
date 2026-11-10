import type {Series} from 'sentry/types/echarts';

/**
 * Shift data points from bucket-start to bucket-end timestamps.
 * The API returns timestamps at the start of each bucket (e.g. 1pm for 1pm–2pm),
 * but we want to display them at the end (2pm) since the value represents
 * the data collected during the preceding interval.
 *
 * The reason we do this for metric charts is that it's important that the data points
 * visually align with the open period markers. If an open period starts at 1pm, it should
 * be vertically aligned with the data point for 12pm-1pm.
 */
export function shiftSeriesToBucketEnd(
  seriesList: Series[],
  intervalSeconds: number
): Series[] {
  const offsetMs = intervalSeconds * 1000;

  return seriesList.map(s => ({
    ...s,
    data: s.data.map(point => ({
      ...point,
      name: new Date(point.name).getTime() + offsetMs,
    })),
  }));
}
