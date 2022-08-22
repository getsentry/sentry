import {ColumnType} from 'sentry/utils/discover/fields';
import {getDuration} from 'sentry/utils/formatters';

import {HistogramData} from './types';

export function getBucketWidth(data: HistogramData) {
  // We can assume that all buckets are of equal width, use the first two
  // buckets to get the width. The value of each histogram function indicates
  // the beginning of the bucket.
  return data.length >= 2 ? data[1].bin - data[0].bin : 0;
}

export function computeBuckets(data: HistogramData) {
  const width = getBucketWidth(data);

  return data.map(item => {
    const bucket = item.bin;
    return {
      start: bucket,
      end: bucket + width,
    };
  });
}

export function formatHistogramData(
  data: HistogramData,
  {
    precision,
    type,
    additionalFieldsFn,
  }: {
    additionalFieldsFn?: any;
    precision?: number;
    type?: ColumnType;
  } = {}
) {
  const formatter = (value: number): string => {
    switch (type) {
      case 'duration':
        const decimalPlaces = precision ?? (value < 1000 ? 0 : 3);
        return getDuration(value / 1000, decimalPlaces, true);
      case 'number':
        // This is trying to avoid some of potential rounding errors that cause bins
        // have the same label, if the number of bins doesn't visually match what is
        // expected, check that this rounding is correct. If this issue persists,
        // consider formatting the bin as a string in the response
        const factor = 10 ** (precision ?? 0);
        return (Math.round((value + Number.EPSILON) * factor) / factor).toLocaleString();
      default:
        throw new Error(`Unable to format type: ${type}`);
    }
  };
  return data.map(item => {
    return {
      value: item.count,
      name: formatter(item.bin),
      ...(additionalFieldsFn?.(item.bin) ?? {}),
    };
  });
}
