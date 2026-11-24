import {getDiffInMinutes, type DateTimeObject} from 'sentry/components/charts/utils';

/**
 * Horizontal space each bar needs, gap included, to stay readable.
 */
const MIN_BAR_SLOT_PX = 6;

/**
 * Bar budget for a chart that hasn't been measured yet, like one mounted
 * while hidden. It's replaced once the chart has a real width.
 */
const DEFAULT_MAX_BARS = 100;

/**
 * Intervals the graph can use, smallest first, with their length in minutes.
 * Most steps grow by 1.5x or less, so narrowing the chart drops a few bars at a
 * time instead of halving them.
 */
const INTERVALS = [
  ['1m', 1],
  ['2m', 2],
  ['3m', 3],
  ['5m', 5],
  ['10m', 10],
  ['15m', 15],
  ['20m', 20],
  ['30m', 30],
  ['45m', 45],
  ['1h', 60],
  ['90m', 90],
  ['2h', 120],
  ['3h', 180],
  ['4h', 240],
  ['6h', 360],
  ['8h', 480],
  ['12h', 720],
  ['18h', 1080],
  ['1d', 1440],
  ['36h', 2160],
  ['2d', 2880],
  ['3d', 4320],
  ['4d', 5760],
  ['7d', 10080],
] as const;

/**
 * The most bars that fit in a chart of this width.
 */
export function getMaxBars(chartWidth: number): number {
  return Math.floor(chartWidth / MIN_BAR_SLOT_PX);
}

/**
 * Picks the smallest interval whose bars fit in the chart.
 */
export function getEventGraphInterval(datetime: DateTimeObject, maxBars: number): string {
  const barBudget = maxBars > 0 ? maxBars : DEFAULT_MAX_BARS;
  const periodMinutes = getDiffInMinutes(datetime);
  const fitting = INTERVALS.find(([, minutes]) => periodMinutes / minutes <= barBudget);
  // Even weekly bars don't fit, so use the longest interval anyway
  return fitting?.[0] ?? '7d';
}
