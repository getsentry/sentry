import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

/**
 * Generate a TimeSeries for an arbitrary time range with a random-walk
 * shape so charts look organic in stories.
 */
export function makeRandomWalkTimeSeries(
  startMs: number,
  endMs: number,
  pointCount = 50
): TimeSeries {
  const interval = Math.max(Math.floor((endMs - startMs) / pointCount), 1);
  const values: Array<{timestamp: number; value: number}> = [];
  let current = 100;

  for (let ts = startMs; ts <= endMs; ts += interval) {
    current += (Math.random() - 0.48) * 10;
    current = Math.max(current, 1);
    values.push({timestamp: ts, value: current});
  }

  return {
    yAxis: 'count()',
    meta: {valueType: 'number', valueUnit: null, interval},
    values,
  };
}
