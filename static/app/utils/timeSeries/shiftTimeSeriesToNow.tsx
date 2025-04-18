import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

export function shiftTimeSeriesToNow(timeSeries: TimeSeries): TimeSeries {
  const currentTimestamp = Date.now();

  const lastDatum = timeSeries.data.at(-1);
  if (!lastDatum) {
    return timeSeries;
  }

  const lastTimestampInTimeserie = new Date(lastDatum.timestamp).getTime();
  const diff = currentTimestamp - lastTimestampInTimeserie;

  return {
    ...timeSeries,
    data: timeSeries.data.map(datum => ({
      ...datum,
      timestamp: new Date(new Date(datum.timestamp).getTime() + diff).toISOString(),
    })),
  };
}
