import type {TimeseriesData} from './types';

export function shiftTimeserieToNow(timeserie: TimeseriesData): TimeseriesData {
  const currentTimestamp = new Date().getTime();

  const lastDatum = timeserie.data.at(-1);
  if (!lastDatum) {
    return timeserie;
  }

  const lastTimestampInTimeserie = new Date(lastDatum.timestamp).getTime();
  const diff = currentTimestamp - lastTimestampInTimeserie;

  return {
    ...timeserie,
    data: timeserie.data.map(datum => ({
      ...datum,
      timestamp: new Date(new Date(datum.timestamp).getTime() + diff).toISOString(),
    })),
  };
}
