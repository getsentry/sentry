import type {ECharts} from 'echarts';
import type {Query} from 'history';

import type {Organization} from 'sentry/types/organization';
import type {WebVital} from 'sentry/utils/fields';
import type {HistogramData} from 'sentry/utils/performance/histogram/types';
import {getBucketWidth} from 'sentry/utils/performance/histogram/utils';
import type {VitalsData} from 'sentry/utils/performance/vitals/vitalsCardsDiscoverQuery';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';

import type {Point, Rectangle} from './types';

export function generateVitalsRoute({
  organization,
}: {
  organization: Organization;
}): string {
  return `${getTransactionSummaryBaseUrl(organization)}/vitals/`;
}

export function vitalsRouteWithQuery({
  organization,
  transaction,
  projectID,
  query,
}: {
  organization: Organization;
  query: Query;
  transaction: string;
  projectID?: string | string[];
}) {
  const pathname = generateVitalsRoute({
    organization,
  });

  return {
    pathname,
    query: {
      transaction,
      project: projectID,
      environment: query.environment,
      statsPeriod: query.statsPeriod,
      start: query.start,
      end: query.end,
      query: query.query,
    },
  };
}

/**
 * Given a value on the x-axis, return the index of the nearest bucket or null
 * if it cannot be found.
 *
 * A bucket contains a range of values, and nearest is defined as the bucket the
 * value will fall in.
 */
export function findNearestBucketIndex(
  chartData: HistogramData,
  xAxis: number
): number | null {
  const width = getBucketWidth(chartData);
  // it's possible that the data is not available yet or the x axis is out of range
  if (!chartData.length || xAxis >= chartData[chartData.length - 1]!.bin + width) {
    return null;
  }
  if (xAxis < chartData[0]!.bin) {
    return -1;
  }

  return Math.floor((xAxis - chartData[0]!.bin) / width);
}

/**
 * To compute pixel coordinates, we need at least 2 unique points on the chart.
 * The two points must have different x axis and y axis values for it to work.
 *
 * If all bars have the same y value, pick the most naive reference rect. This
 * may result in floating point errors, but should be okay for our purposes.
 */
export function getRefRect(chartData: HistogramData): Rectangle | null {
  // not enough points to construct 2 reference points
  if (chartData.length < 2) {
    return null;
  }

  for (let i = 0; i < chartData.length; i++) {
    const data1 = chartData[i];
    for (let j = i + 1; j < chartData.length; j++) {
      const data2 = chartData[j]!;

      if (data1!.bin !== data2.bin && data1!.count !== data2.count) {
        return {
          point1: {x: i, y: Math.min(data1!.count, data2.count)},
          point2: {x: j, y: Math.max(data1!.count, data2.count)},
        };
      }
    }
  }

  // all data points have the same count, just pick any 2 histogram bins
  // and use 0 and 1 as the count as we can rely on them being on the graph
  return {
    point1: {x: 0, y: 0},
    point2: {x: 1, y: 1},
  };
}

/**
 * Given an ECharts instance and a rectangle defined in terms of the x and y axis,
 * compute the corresponding pixel coordinates. If it cannot be done, return null.
 */
export function asPixelRect(chartRef: ECharts, dataRect: Rectangle): Rectangle | null {
  const point1 = chartRef.convertToPixel({xAxisIndex: 0, yAxisIndex: 0}, [
    dataRect.point1.x,
    dataRect.point1.y,
  ]);

  if (isNaN(point1?.[0]!) || isNaN(point1?.[1]!)) {
    return null;
  }

  const point2 = chartRef.convertToPixel({xAxisIndex: 0, yAxisIndex: 0}, [
    dataRect.point2.x,
    dataRect.point2.y,
  ]);

  if (isNaN(point2?.[0]!) || isNaN(point2?.[1]!)) {
    return null;
  }

  return {
    point1: {x: point1[0]!, y: point1[1]!},
    point2: {x: point2[0]!, y: point2[1]!},
  };
}

/**
 * Given a point on a source rectangle, map it to the corresponding point on the
 * destination rectangle. Assumes that the two rectangles are related by a simple
 * transformation containing only translations and scaling.
 */
export function mapPoint(
  point: Point,
  srcRect: Rectangle,
  destRect: Rectangle
): Point | null {
  if (
    srcRect.point1.x === srcRect.point2.x ||
    srcRect.point1.y === srcRect.point2.y ||
    destRect.point1.x === destRect.point2.x ||
    destRect.point1.y === destRect.point2.y
  ) {
    return null;
  }

  const xPercentage =
    (point.x - srcRect.point1.x) / (srcRect.point2.x - srcRect.point1.x);
  const yPercentage =
    (point.y - srcRect.point1.y) / (srcRect.point2.y - srcRect.point1.y);

  return {
    x: destRect.point1.x + (destRect.point2.x - destRect.point1.x) * xPercentage,
    y: destRect.point1.y + (destRect.point2.y - destRect.point1.y) * yPercentage,
  };
}

export function isMissingVitalsData(
  vitalsData: VitalsData | null,
  allVitals: WebVital[]
): boolean {
  if (!vitalsData || allVitals.some(vital => !vitalsData[vital])) {
    return true;
  }

  const measurementsWithoutCounts = Object.values(vitalsData).filter(
    vitalObj => vitalObj.total === 0
  );
  return measurementsWithoutCounts.length > 0;
}
