import {ColumnType} from 'sentry/utils/discover/fields';
import {getDuration} from 'sentry/utils/formatters';

import {HistogramData} from './types';

/**
 * Given two histogram data, matches the bin size between the two histograms
 * Todo - Make it work for more bin sizes
 * @param data1 echarts histogram data array
 * @param data2 echarts histrogram data array
 * @returns an array of the data with the matched bin size and the updatedsize [updated data1, updated data2, updated size]
 */
export function matchBinSize(
  data1: HistogramData,
  data2: HistogramData,
  options: {autoBinWidthIncrease?: boolean; newBinWidth?: number} = {}
): [HistogramData, HistogramData, number] {
  if (!data1.length || !data2.length) {
    return [data1, data2, 0];
  }
  let {newBinWidth} = options;

  newBinWidth ??= Math.max(getBucketWidth(data1), getBucketWidth(data2));

  if (options.autoBinWidthIncrease) {
    const maxBin = Math.max(data1[data1.length - 1].bin, data2[data2.length - 1].bin);
    const minBin = Math.min(data1[0].bin, data2[0].bin);
    if ((maxBin - minBin) / newBinWidth > 30) {
      newBinWidth = Math.round((maxBin - minBin) / 30);
    }
  }

  return [
    updateBinWidth(data1, newBinWidth),
    updateBinWidth(data2, newBinWidth),
    newBinWidth,
  ];
}

/**
 * Combines histogram bins in order to increase the bin width
 * @param data echarts histogram data
 * @param binWidth new larger bin width
 * @returns updated histrogram data
 */
export function updateBinWidth(
  data: HistogramData,
  binWidth: number,
  startingBin?: number
): HistogramData {
  const updatedData: HistogramData = [];
  let binIndex = 0;
  let currentBinMax = startingBin || binWidth;

  while (binIndex < data.length) {
    let binCount = 0;
    while (binIndex < data.length && data[binIndex].bin <= currentBinMax) {
      binCount += data[binIndex].count;
      binIndex++;
    }
    updatedData.push({bin: currentBinMax, count: binCount});
    currentBinMax += binWidth;
  }

  return updatedData;
}

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
