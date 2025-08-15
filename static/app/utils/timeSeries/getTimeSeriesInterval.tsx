import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

/**
 * The interval of a TimeSeries is the difference in the timestamps between the data points. This function only works for zerofilled `TimeSeries` objects, which in practice should be all of them. This function is only useful when converting older-style server responses to newer-styled responses, since newer style responses return the interval as part of the response meta.
 */
export function getTimeSeriesInterval(timeSeriesValues: TimeSeries['values']): number {
  const penultimateDatum = timeSeriesValues.at(-2);
  const finalDatum = timeSeriesValues.at(-1);

  let bucketSize = 0;
  if (penultimateDatum && finalDatum) {
    bucketSize =
      new Date(finalDatum.timestamp).getTime() -
      new Date(penultimateDatum.timestamp).getTime();
  }

  return bucketSize;
}
