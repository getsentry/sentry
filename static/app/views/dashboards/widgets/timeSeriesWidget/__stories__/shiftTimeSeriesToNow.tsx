import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

export function shiftTimeSeriesToNow(timeSeries: TimeSeries): TimeSeries {
  const currentTimestamp = Date.now();

  const lastDatum = timeSeries.values.at(-1);
  if (!lastDatum) {
    return timeSeries;
  }

  const lastTimestampInTimeserie = new Date(lastDatum.timestamp).getTime();
  const diff = currentTimestamp - lastTimestampInTimeserie;

  return {
    ...timeSeries,
    values: timeSeries.values.map(datum => ({
      ...datum,
      timestamp: datum.timestamp + diff,
    })),
  };
}
