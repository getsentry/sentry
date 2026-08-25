import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import {isZeroDurationNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/utils';

export const COLLAPSED_GAP_WIDTH_PX = 28;
const MIN_COLLAPSIBLE_GAP_WIDTH_PX = COLLAPSED_GAP_WIDTH_PX * 2;
const COMPARISON_EPSILON = 1e-9;
const DURATION_LABEL_BUFFER_PX = 48;
const MARKER_PADDING_PX = 10;
const MARKER_PADDING_MAX_MS = 500;

type Interval = [start: number, end: number];

export type TraceTimeCompressionGap = {
  compressedEnd: number;
  compressedStart: number;
  duration: number;
  end: number;
  retainedDuration: number;
  start: number;
};

type TraceTimeCompressionOptions = {
  enabled: boolean;
  indicators: TraceTree['indicators'];
  nodes: BaseNode[];
  physicalWidth: number;
  traceSpace: [start: number, duration: number];
  viewSpace?: [start: number, duration: number];
};

export class TraceTimeCompression {
  readonly gaps: TraceTimeCompressionGap[];
  readonly start: number;
  readonly duration: number;
  readonly compressedDuration: number;
  readonly enabled: boolean;

  private constructor(options: {
    compressedDuration: number;
    duration: number;
    enabled: boolean;
    gaps: TraceTimeCompressionGap[];
    start: number;
  }) {
    this.start = options.start;
    this.duration = options.duration;
    this.compressedDuration = options.compressedDuration;
    this.gaps = options.gaps;
    this.enabled = options.enabled && options.gaps.length > 0;
  }

  static Disabled(traceSpace: [start: number, duration: number] = [0, 0]) {
    return new TraceTimeCompression({
      start: traceSpace[0],
      duration: traceSpace[1],
      compressedDuration: traceSpace[1],
      gaps: [],
      enabled: false,
    });
  }

  static FromVisibleItems(options: TraceTimeCompressionOptions): TraceTimeCompression {
    const [traceStart, traceDuration] = options.traceSpace;
    const [viewStart, viewDuration] = options.viewSpace ?? options.traceSpace;

    if (
      !options.enabled ||
      traceDuration <= 0 ||
      viewDuration <= 0 ||
      options.physicalWidth <= 0
    ) {
      return TraceTimeCompression.Disabled(options.traceSpace);
    }

    const intervals = collectVisibleIntervals(options);
    const mergedIntervals = mergeIntervals(intervals);
    const traceEnd = traceStart + traceDuration;
    const viewEnd = viewStart + viewDuration;
    const timestampComparisonEpsilon = Math.max(
      traceDuration * COMPARISON_EPSILON,
      Number.EPSILON
    );
    const isZoomedView =
      viewStart > traceStart + timestampComparisonEpsilon ||
      viewEnd < traceEnd - timestampComparisonEpsilon;
    const collapsibleGaps = collectGaps(mergedIntervals, traceStart, traceDuration)
      .map(gap => ({
        gap,
        visibleDuration: getIntersectionDuration(gap, viewStart, viewEnd),
      }))
      .filter(
        ({gap: [gapStart, gapEnd], visibleDuration}) =>
          (visibleDuration / viewDuration) * options.physicalWidth >=
            MIN_COLLAPSIBLE_GAP_WIDTH_PX - COMPARISON_EPSILON &&
          (!isZoomedView ||
            (gapStart > viewStart + timestampComparisonEpsilon &&
              gapEnd < viewEnd - timestampComparisonEpsilon))
      );

    if (collapsibleGaps.length === 0) {
      return TraceTimeCompression.Disabled(options.traceSpace);
    }

    const collapsedVisibleDuration = collapsibleGaps.reduce(
      (sum, {visibleDuration}) => sum + visibleDuration,
      0
    );
    const activeVisibleDuration = viewDuration - collapsedVisibleDuration;
    const collapsedGapWidthRatio = COLLAPSED_GAP_WIDTH_PX / options.physicalWidth;
    const visibleGapFractionSum = collapsibleGaps.reduce(
      (sum, {gap, visibleDuration}) =>
        sum + visibleDuration / Math.max(gap[1] - gap[0], Number.EPSILON),
      0
    );
    const denominator = 1 - collapsedGapWidthRatio * visibleGapFractionSum;

    if (denominator <= 0 || activeVisibleDuration <= 0) {
      return TraceTimeCompression.Disabled(options.traceSpace);
    }

    const compressedViewDuration = activeVisibleDuration / denominator;
    const retainedDuration = compressedViewDuration * collapsedGapWidthRatio;
    let removedBefore = 0;

    const gaps = collapsibleGaps.map(({gap: [start, end]}) => {
      const duration = end - start;
      const compressedStart = start - traceStart - removedBefore;
      const compressedEnd = compressedStart + retainedDuration;
      removedBefore += duration - retainedDuration;

      return {
        start,
        end,
        duration,
        retainedDuration,
        compressedStart,
        compressedEnd,
      };
    });
    const compressedDuration =
      traceDuration -
      gaps.reduce((sum, gap) => sum + gap.duration - gap.retainedDuration, 0);

    return new TraceTimeCompression({
      start: traceStart,
      duration: traceDuration,
      compressedDuration,
      gaps,
      enabled: true,
    });
  }

  toCompressedOffset(timestamp: number): number {
    if (!this.enabled) {
      return timestamp - this.start;
    }

    let removedBefore = 0;

    for (const gap of this.gaps) {
      if (timestamp < gap.start) {
        break;
      }

      if (timestamp <= gap.end) {
        const progress = gap.duration > 0 ? (timestamp - gap.start) / gap.duration : 0;
        return gap.compressedStart + progress * gap.retainedDuration;
      }

      removedBefore += gap.duration - gap.retainedDuration;
    }

    return timestamp - this.start - removedBefore;
  }

  toRealTimestamp(compressedOffset: number): number {
    if (!this.enabled) {
      return this.start + compressedOffset;
    }

    let restoredBefore = 0;

    for (const gap of this.gaps) {
      if (compressedOffset < gap.compressedStart) {
        break;
      }

      if (compressedOffset <= gap.compressedEnd) {
        const progress =
          gap.retainedDuration > 0
            ? (compressedOffset - gap.compressedStart) / gap.retainedDuration
            : 0;
        return gap.start + progress * gap.duration;
      }

      restoredBefore += gap.duration - gap.retainedDuration;
    }

    return this.start + compressedOffset + restoredBefore;
  }
}

function collectVisibleIntervals(options: TraceTimeCompressionOptions): Interval[] {
  const [traceStart, traceDuration] = options.traceSpace;
  const [, viewDuration] = options.viewSpace ?? options.traceSpace;
  const traceEnd = traceStart + traceDuration;
  const durationPerPixel = viewDuration / options.physicalWidth;
  const markerPadding = Math.min(
    durationPerPixel * MARKER_PADDING_PX,
    MARKER_PADDING_MAX_MS
  );
  const durationLabelBuffer =
    options.physicalWidth > 0 ? durationPerPixel * DURATION_LABEL_BUFFER_PX : 0;
  const zeroDurationBuffer =
    options.physicalWidth > 0 ? durationPerPixel * COLLAPSED_GAP_WIDTH_PX : 0;
  const intervals: Interval[] = [];

  for (const node of options.nodes) {
    if (node.type === 'trace' || node.type === 'root') {
      continue;
    }

    const start = clampTimestamp(node.space[0], traceStart, traceEnd);
    const end = clampTimestamp(node.space[0] + node.space[1], traceStart, traceEnd);

    if (end > start) {
      intervals.push([
        clampTimestamp(start - durationLabelBuffer, traceStart, traceEnd),
        clampTimestamp(end + durationLabelBuffer, traceStart, traceEnd),
      ]);
    } else {
      const nodeBuffer = isZeroDurationNode(node) ? zeroDurationBuffer : markerPadding;
      intervals.push([
        clampTimestamp(start - nodeBuffer, traceStart, traceEnd),
        clampTimestamp(start + nodeBuffer, traceStart, traceEnd),
      ]);
    }
  }

  for (const indicator of options.indicators) {
    intervals.push([
      clampTimestamp(indicator.start - markerPadding, traceStart, traceEnd),
      clampTimestamp(indicator.start + markerPadding, traceStart, traceEnd),
    ]);
  }

  return intervals;
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter(([start, end]) => end >= start)
    .sort((a, b) => a[0] - b[0]);

  const [first, ...rest] = sorted;
  if (!first) {
    return [];
  }

  let last = first;
  const merged: Interval[] = [last];

  for (const current of rest) {
    if (current[0] <= last[1]) {
      last[1] = Math.max(last[1], current[1]);
    } else {
      merged.push(current);
      last = current;
    }
  }

  return merged;
}

function collectGaps(
  intervals: Interval[],
  traceStart: number,
  traceDuration: number
): Interval[] {
  const traceEnd = traceStart + traceDuration;
  const gaps: Interval[] = [];
  let previousEnd = traceStart;

  for (const [start, end] of intervals) {
    if (start > previousEnd) {
      gaps.push([previousEnd, start]);
    }
    previousEnd = Math.max(previousEnd, end);
  }

  if (traceEnd > previousEnd) {
    gaps.push([previousEnd, traceEnd]);
  }

  return gaps;
}

function getIntersectionDuration(interval: Interval, start: number, end: number): number {
  return Math.max(0, Math.min(interval[1], end) - Math.max(interval[0], start));
}

function clampTimestamp(timestamp: number, min: number, max: number): number {
  return Math.min(Math.max(timestamp, min), max);
}
