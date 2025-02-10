import type {TimeSeries} from '../common/types';

export function shiftTimeserieToNow(timeSeries: TimeSeries): TimeSeries {
  const currentTimestamp = new Date().getTime();

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
