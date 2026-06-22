import {mat3, vec2} from 'gl-matrix';

import {TraceTimeCompression} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceTimeCompression';
import type {TraceView} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceView';

export type CompressedView = {left: number; right: number; width: number};
export type SpanMatrix = [number, number, number, number, number, number];
export type TraceIconEdge = 'start' | 'end' | null;

export type TraceViewCalculationContext = {
  getCompressedView: () => CompressedView;
  getConfigSpacePerPx: () => number;
  spanMatrix: SpanMatrix;
  spanToPx: mat3;
  timeCompression: TraceTimeCompression;
  view: TraceView;
};

export interface TraceViewCalculations {
  /**
   * Return the visual left position of a timestamp within a parent span.
   */
  computeRelativeLeftPositionFromOrigin(
    context: TraceViewCalculationContext,
    timestamp: number,
    entireSpace: [number, number]
  ): number;
  /**
   * Return the visual width of a child span relative to a parent span.
   */
  computeRelativeWidth(
    context: TraceViewCalculationContext,
    space: [number, number],
    entireSpace: [number, number]
  ): number;
  /**
   * Build the CSS matrix used to position and scale a span bar in the timeline.
   */
  computeSpanCSSMatrixTransform(
    context: TraceViewCalculationContext,
    space: [number, number]
  ): SpanMatrix;
  /**
   * Convert a fixed-width icon around a timestamp into trace-space bounds.
   */
  computeTraceIconBounds(
    context: TraceViewCalculationContext,
    anchorTimestamp: number,
    iconWidthPx: number,
    edge: TraceIconEdge
  ): [number, number];
  /**
   * Compute the next trace view after a horizontal wheel pan.
   */
  computeWheelPanView(
    context: TraceViewCalculationContext,
    physicalDeltaPct: number
  ): {x: number; width?: number};
  /**
   * Compute the next trace view after wheel zooming around a physical x position.
   */
  computeWheelZoomView(
    context: TraceViewCalculationContext,
    x: number,
    scale: number
  ): [number, number, number, number];
  /**
   * Convert a cursor position in physical pixels to the trace view's config space.
   */
  getConfigSpaceCursor(
    context: TraceViewCalculationContext,
    cursor: {x: number; y: number}
  ): [number, number];
  /**
   * Expand a zoom target so text near the selected span remains visible.
   */
  padZoomIntoSpace(
    context: TraceViewCalculationContext,
    x: number,
    width: number
  ): {width: number; x: number};
  /**
   * Recompute the matrix that maps trace-space duration to physical pixels.
   */
  recomputeSpanToPXMatrix(context: TraceViewCalculationContext): mat3;
  /**
   * Recompute timeline tick offsets for the current visible view.
   */
  recomputeTimelineIntervals(
    context: TraceViewCalculationContext,
    intervals: Array<number | undefined>
  ): void;
  /**
   * Convert an absolute timestamp to a physical x offset in the visible timeline.
   */
  transformXFromTimestamp(
    context: TraceViewCalculationContext,
    timestamp: number
  ): number;
}

export class NormalTraceViewCalculations implements TraceViewCalculations {
  computeWheelZoomView(
    context: TraceViewCalculationContext,
    x: number,
    scale: number
  ): [number, number, number, number] {
    const configSpaceCursor = this.getConfigSpaceCursor(context, {x, y: 0});
    const center = vec2.fromValues(configSpaceCursor[0], 0);
    const centerScaleMatrix = mat3.create();

    mat3.fromTranslation(centerScaleMatrix, center);
    mat3.scale(centerScaleMatrix, centerScaleMatrix, vec2.fromValues(scale, 1));
    mat3.translate(centerScaleMatrix, centerScaleMatrix, vec2.fromValues(-center[0], 0));

    return context.view.trace_view.transform(centerScaleMatrix);
  }

  computeWheelPanView(
    context: TraceViewCalculationContext,
    physicalDeltaPct: number
  ): {x: number} {
    return {
      x: context.view.trace_view.x + physicalDeltaPct * context.view.trace_view.width,
    };
  }

  padZoomIntoSpace(
    context: TraceViewCalculationContext,
    x: number,
    width: number
  ): {width: number; x: number} {
    const mat = context.view.getSpanToPxForSpace([x, width]);
    const offsetInConfigSpace = 74 * mat[0];

    return {
      x: x - offsetInConfigSpace,
      width: width + offsetInConfigSpace * 2,
    };
  }

  getConfigSpaceCursor(
    context: TraceViewCalculationContext,
    cursor: {x: number; y: number}
  ): [number, number] {
    return context.view.getConfigSpaceCursor(cursor);
  }

  recomputeSpanToPXMatrix(context: TraceViewCalculationContext): mat3 {
    const traceViewToSpace = context.view.trace_space.between(context.view.trace_view);
    const tracePhysicalToView = context.view.trace_physical_space.between(
      context.view.trace_space
    );

    return mat3.multiply(context.spanToPx, traceViewToSpace, tracePhysicalToView);
  }

  computeSpanCSSMatrixTransform(
    context: TraceViewCalculationContext,
    space: [number, number]
  ): SpanMatrix {
    return computeSpanCSSMatrixTransformInVisibleSpace(context, space);
  }

  transformXFromTimestamp(
    context: TraceViewCalculationContext,
    timestamp: number
  ): number {
    const configSpacePerPx = context.getConfigSpacePerPx();
    return (
      (timestamp - context.view.to_origin - context.view.trace_view.x) / configSpacePerPx
    );
  }

  computeRelativeLeftPositionFromOrigin(
    _context: TraceViewCalculationContext,
    timestamp: number,
    entireSpace: [number, number]
  ): number {
    const range = entireSpace[1];
    if (range === 0) {
      return 0;
    }
    return (timestamp - entireSpace[0]) / range;
  }

  computeRelativeWidth(
    _context: TraceViewCalculationContext,
    space: [number, number],
    entireSpace: [number, number]
  ): number {
    if (entireSpace[1] === 0) {
      return 0;
    }
    return space[1] / entireSpace[1];
  }

  computeTraceIconBounds(
    context: TraceViewCalculationContext,
    anchorTimestamp: number,
    iconWidthPx: number,
    edge: TraceIconEdge
  ): [number, number] {
    const iconWidth = iconWidthPx * context.getConfigSpacePerPx();
    if (edge === 'start') {
      return [anchorTimestamp, anchorTimestamp + iconWidth];
    }
    if (edge === 'end') {
      return [anchorTimestamp - iconWidth, anchorTimestamp];
    }
    return [anchorTimestamp - iconWidth / 2, anchorTimestamp + iconWidth / 2];
  }

  recomputeTimelineIntervals(
    context: TraceViewCalculationContext,
    intervals: Array<number | undefined>
  ): void {
    const timeAt100 =
      (110 * window.devicePixelRatio * context.view.trace_view.width) /
      Math.max(context.view.trace_physical_space.width, 1);

    computeTimelineIntervals(context.view, timeAt100, intervals);
  }
}

export class CompressedTraceViewCalculations implements TraceViewCalculations {
  computeWheelZoomView(
    context: TraceViewCalculationContext,
    x: number,
    scale: number
  ): [number, number, number, number] {
    const compressedView = context.getCompressedView();
    const leftPercentage = x / context.view.trace_physical_space.width;
    const compressedCursor = compressedView.left + leftPercentage * compressedView.width;
    const nextCompressedLeft =
      compressedCursor + (compressedView.left - compressedCursor) * scale;
    const nextCompressedRight =
      compressedCursor + (compressedView.right - compressedCursor) * scale;
    const nextRealLeft = context.timeCompression.toRealTimestamp(nextCompressedLeft);
    const nextRealRight = context.timeCompression.toRealTimestamp(nextCompressedRight);

    return [
      nextRealLeft - context.view.to_origin,
      context.view.trace_view.y,
      nextRealRight - nextRealLeft,
      context.view.trace_view.height,
    ];
  }

  computeWheelPanView(
    context: TraceViewCalculationContext,
    physicalDeltaPct: number
  ): {width: number; x: number} {
    const compressedView = context.getCompressedView();
    const compressedDelta = physicalDeltaPct * compressedView.width;
    const nextCompressedLeft = compressedView.left + compressedDelta;
    const nextCompressedRight = compressedView.right + compressedDelta;
    const nextRealLeft = context.timeCompression.toRealTimestamp(nextCompressedLeft);
    const nextRealRight = context.timeCompression.toRealTimestamp(nextCompressedRight);

    return {
      x: nextRealLeft - context.view.to_origin,
      width: nextRealRight - nextRealLeft,
    };
  }

  padZoomIntoSpace(
    context: TraceViewCalculationContext,
    x: number,
    width: number
  ): {width: number; x: number} {
    const compressedPxRatio = context.spanToPx[0];
    const paddingCompressedMs = 74 * compressedPxRatio;
    const realStart = x + context.view.to_origin;
    const realEnd = realStart + width;
    const compressedStart = context.timeCompression.toCompressedOffset(realStart);
    const compressedEnd = context.timeCompression.toCompressedOffset(realEnd);
    const paddedStart = context.timeCompression.toRealTimestamp(
      compressedStart - paddingCompressedMs
    );
    const paddedEnd = context.timeCompression.toRealTimestamp(
      compressedEnd + paddingCompressedMs
    );

    return {
      x: paddedStart - context.view.to_origin,
      width: paddedEnd - paddedStart,
    };
  }

  getConfigSpaceCursor(
    context: TraceViewCalculationContext,
    cursor: {x: number; y: number}
  ): [number, number] {
    const leftPercentage = cursor.x / context.view.trace_physical_space.width;
    const compressedView = context.getCompressedView();
    const compressedCursor = compressedView.left + leftPercentage * compressedView.width;
    return [
      context.timeCompression.toRealTimestamp(compressedCursor) - context.view.to_origin,
      0,
    ];
  }

  recomputeSpanToPXMatrix(context: TraceViewCalculationContext): mat3 {
    const compressedView = context.getCompressedView();
    const spanToPx = mat3.identity(context.spanToPx);
    spanToPx[0] =
      compressedView.width / Math.max(context.view.trace_physical_space.width, 1);
    return spanToPx;
  }

  computeSpanCSSMatrixTransform(
    context: TraceViewCalculationContext,
    space: [number, number]
  ): SpanMatrix {
    return computeSpanCSSMatrixTransformInVisibleSpace(context, space);
  }

  transformXFromTimestamp(
    context: TraceViewCalculationContext,
    timestamp: number
  ): number {
    return (
      (context.timeCompression.toCompressedOffset(timestamp) -
        context.getCompressedView().left) /
      context.spanToPx[0]
    );
  }

  computeRelativeLeftPositionFromOrigin(
    context: TraceViewCalculationContext,
    timestamp: number,
    entireSpace: [number, number]
  ): number {
    const compressedStart = context.timeCompression.toCompressedOffset(entireSpace[0]);
    const compressedEnd = context.timeCompression.toCompressedOffset(
      entireSpace[0] + entireSpace[1]
    );
    const compressedTimestamp = context.timeCompression.toCompressedOffset(timestamp);
    const compressedRange = compressedEnd - compressedStart;
    if (compressedRange === 0) {
      return 0;
    }
    return (compressedTimestamp - compressedStart) / compressedRange;
  }

  computeRelativeWidth(
    context: TraceViewCalculationContext,
    space: [number, number],
    entireSpace: [number, number]
  ): number {
    const compressedStart = context.timeCompression.toCompressedOffset(space[0]);
    const compressedEnd = context.timeCompression.toCompressedOffset(space[0] + space[1]);
    const compressedEntireStart = context.timeCompression.toCompressedOffset(
      entireSpace[0]
    );
    const compressedEntireEnd = context.timeCompression.toCompressedOffset(
      entireSpace[0] + entireSpace[1]
    );
    const compressedEntireRange = compressedEntireEnd - compressedEntireStart;
    if (compressedEntireRange === 0) {
      return 0;
    }
    return (compressedEnd - compressedStart) / compressedEntireRange;
  }

  computeTraceIconBounds(
    context: TraceViewCalculationContext,
    anchorTimestamp: number,
    iconWidthPx: number,
    edge: TraceIconEdge
  ): [number, number] {
    const compressedAnchor = context.timeCompression.toCompressedOffset(anchorTimestamp);
    const iconWidthCompressed = iconWidthPx * context.spanToPx[0];

    if (edge === 'start') {
      return [
        anchorTimestamp,
        context.timeCompression.toRealTimestamp(compressedAnchor + iconWidthCompressed),
      ];
    }
    if (edge === 'end') {
      return [
        context.timeCompression.toRealTimestamp(compressedAnchor - iconWidthCompressed),
        anchorTimestamp,
      ];
    }
    const half = iconWidthCompressed / 2;
    return [
      context.timeCompression.toRealTimestamp(compressedAnchor - half),
      context.timeCompression.toRealTimestamp(compressedAnchor + half),
    ];
  }

  recomputeTimelineIntervals(
    context: TraceViewCalculationContext,
    intervals: Array<number | undefined>
  ): void {
    const compressedView = context.getCompressedView();
    const targetInterval =
      (110 * window.devicePixelRatio * compressedView.width) /
      Math.max(context.view.trace_physical_space.width, 1);

    computeCompressedTimelineIntervals(
      compressedView,
      targetInterval,
      context.timeCompression,
      context.view.to_origin,
      intervals
    );
  }
}

function computeSpanCSSMatrixTransformInVisibleSpace(
  context: TraceViewCalculationContext,
  space: [number, number]
): SpanMatrix {
  const visibleView = context.getCompressedView();
  const start = context.timeCompression.toCompressedOffset(space[0]);
  const end = context.timeCompression.toCompressedOffset(space[0] + space[1]);
  const duration = Math.max(end - start, 0);
  const scale = duration / visibleView.width;
  context.spanMatrix[0] = Math.max(scale, context.spanToPx[0] / visibleView.width);
  context.spanMatrix[4] = (start - visibleView.left) / context.spanToPx[0];

  const traceEnd = context.timeCompression.toCompressedOffset(
    context.view.to_origin + context.view.trace_space.width
  );
  if (
    space[0] - context.view.to_origin > context.view.trace_space.width / 2 &&
    (traceEnd - end) / context.spanToPx[0] <= 1
  ) {
    context.spanMatrix[4] = context.spanMatrix[4] - 2;
  }

  return context.spanMatrix;
}

function computeTimelineIntervals(
  view: TraceView,
  targetInterval: number,
  results: Array<number | undefined>
): void {
  const interval = computeTimelineTickInterval(targetInterval);

  let x = Math.ceil(view.trace_view.x / interval) * interval;
  let idx = -1;
  if (x > 0) {
    x -= interval;
  }
  while (x <= view.trace_view.right) {
    results[++idx] = x;
    x += interval;
  }

  clearRemainingTimelineIntervals(results, idx);
}

function computeCompressedTimelineIntervals(
  compressedView: CompressedView,
  targetInterval: number,
  compression: TraceTimeCompression,
  toOrigin: number,
  results: Array<number | undefined>
): void {
  const interval = computeTimelineTickInterval(targetInterval);

  let x = Math.ceil(compressedView.left / interval) * interval;
  let idx = -1;
  if (x > compressedView.left) {
    x -= interval;
  }
  while (x <= compressedView.right) {
    const realTimestamp = compression.toRealTimestamp(x);
    results[++idx] = realTimestamp - toOrigin;
    x += interval;
  }

  clearRemainingTimelineIntervals(results, idx);
}

function computeTimelineTickInterval(targetInterval: number): number {
  const minInterval = Math.pow(10, Math.floor(Math.log10(targetInterval)));
  let interval = minInterval;

  if (targetInterval / interval > 5) {
    interval *= 5;
  } else if (targetInterval / interval > 2) {
    interval *= 2;
  }

  return interval;
}

function clearRemainingTimelineIntervals(
  results: Array<number | undefined>,
  idx: number
): void {
  while (idx < results.length - 1 && results[idx + 1] !== undefined) {
    results[++idx] = undefined;
  }
}
