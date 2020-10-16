import {Query} from 'history';
import {ECharts} from 'echarts';

import {HistogramData, Rectangle, Point} from './types';

export function generateVitalsRoute({orgSlug}: {orgSlug: String}): string {
  return `/organizations/${orgSlug}/performance/summary/rum/`;
}

export function vitalsRouteWithQuery({
  orgSlug,
  transaction,
  projectID,
  query,
}: {
  orgSlug: string;
  transaction: string;
  query: Query;
  projectID?: string | string[];
}) {
  const pathname = generateVitalsRoute({
    orgSlug,
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
  chartData: HistogramData[],
  bucketWidth: number,
  xAxis: number
): number | null {
  // it's possible that the data is not available yet or the x axis is out of range
  if (
    !chartData.length ||
    xAxis >= chartData[chartData.length - 1].histogram + bucketWidth
  ) {
    return null;
  } else if (xAxis < chartData[0].histogram) {
    return -1;
  }

  return Math.floor((xAxis - chartData[0].histogram) / bucketWidth);
}

/**
 * To compute pixel coordinates, we need at least 2 unique points on the chart.
 * The two points must have different x axis and y axis values for it to work.
 *
 * If all bars have the same y value, pick the most naive reference rect. This
 * may result in floating point errors, but should be okay for our purposes.
 */
export function getRefRect(chartData: HistogramData[]): Rectangle | null {
  // not enough points to construct 2 reference points
  if (chartData.length < 2) {
    return null;
  }

  for (let i = 0; i < chartData.length; i++) {
    const data1 = chartData[i];
    for (let j = i + 1; j < chartData.length; j++) {
      const data2 = chartData[j];

      if (data1.histogram !== data2.histogram && data1.count !== data2.count) {
        return {
          point1: {x: i, y: Math.min(data1.count, data2.count)},
          point2: {x: j, y: Math.max(data1.count, data2.count)},
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

  if (isNaN(point1?.[0]) || isNaN(point1?.[1])) {
    return null;
  }

  const point2 = chartRef.convertToPixel({xAxisIndex: 0, yAxisIndex: 0}, [
    dataRect.point2.x,
    dataRect.point2.y,
  ]);

  if (isNaN(point2?.[0]) || isNaN(point2?.[1])) {
    return null;
  }

  return {
    point1: {x: point1[0], y: point1[1]},
    point2: {x: point2[0], y: point2[1]},
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
