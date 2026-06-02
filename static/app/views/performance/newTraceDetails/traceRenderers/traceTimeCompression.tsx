import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';

const COLLAPSE_THRESHOLD_RATIO = 0.05;
export const COLLAPSED_GAP_WIDTH_PX = 28;
const DURATION_LABEL_BUFFER_PX = 60;
const MARKER_PADDING_RATIO = 0.01;
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

    if (!options.enabled || traceDuration <= 0 || options.physicalWidth <= 0) {
      return TraceTimeCompression.Disabled(options.traceSpace);
    }

    const intervals = collectVisibleIntervals(options);
    const mergedIntervals = mergeIntervals(intervals);
    const collapsibleGaps = collectCollapsibleGaps(
      mergedIntervals,
      traceStart,
      traceDuration
    );

    if (collapsibleGaps.length === 0) {
      return TraceTimeCompression.Disabled(options.traceSpace);
    }

    const collapsedGapPx = Math.min(
      COLLAPSED_GAP_WIDTH_PX,
      options.physicalWidth / (collapsibleGaps.length + 1)
    );
    const collapsedGapWidthRatio = collapsedGapPx / options.physicalWidth;
    const collapsedDuration = collapsibleGaps.reduce(
      (sum, gap) => sum + (gap[1] - gap[0]),
      0
    );
    const activeDuration = traceDuration - collapsedDuration;
    const denominator = 1 - collapsedGapWidthRatio * collapsibleGaps.length;

    if (denominator <= 0 || activeDuration <= 0) {
      return TraceTimeCompression.Disabled(options.traceSpace);
    }

    const compressedDuration = activeDuration / denominator;
    const retainedDuration = compressedDuration * collapsedGapWidthRatio;
    let removedBefore = 0;

    const gaps = collapsibleGaps.map(([start, end]) => {
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
  const traceEnd = traceStart + traceDuration;
  const markerPadding = Math.min(
    traceDuration * MARKER_PADDING_RATIO,
    MARKER_PADDING_MAX_MS
  );
  const durationLabelBuffer =
    options.physicalWidth > 0
      ? (traceDuration / options.physicalWidth) * DURATION_LABEL_BUFFER_PX
      : 0;
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
      intervals.push([
        clampTimestamp(start - markerPadding, traceStart, traceEnd),
        clampTimestamp(start + markerPadding, traceStart, traceEnd),
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

function collectCollapsibleGaps(
  intervals: Interval[],
  traceStart: number,
  traceDuration: number
): Interval[] {
  const traceEnd = traceStart + traceDuration;
  const threshold = traceDuration * COLLAPSE_THRESHOLD_RATIO;
  const gaps: Interval[] = [];
  let previousEnd = traceStart;

  for (const [start, end] of intervals) {
    if (start - previousEnd >= threshold) {
      gaps.push([previousEnd, start]);
    }
    previousEnd = Math.max(previousEnd, end);
  }

  if (traceEnd - previousEnd >= threshold) {
    gaps.push([previousEnd, traceEnd]);
  }

  return gaps;
}

function clampTimestamp(timestamp: number, min: number, max: number): number {
  return Math.min(Math.max(timestamp, min), max);
}
