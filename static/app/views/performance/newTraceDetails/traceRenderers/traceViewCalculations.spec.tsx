import {mat3} from 'gl-matrix';

import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import {TraceTimeCompression} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceTimeCompression';
import {TraceView} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceView';
import {
  CompressedTraceViewCalculations,
  NormalTraceViewCalculations,
  type CompressedView,
  type SpanMatrix,
  type TraceViewCalculationContext,
} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceViewCalculations';

function makeCalculationContext({
  timeCompression = TraceTimeCompression.Disabled([0, 1000]),
}: {
  timeCompression?: TraceTimeCompression;
} = {}): TraceViewCalculationContext {
  const view = new TraceView();
  const spanToPx = mat3.create();

  view.setTraceSpace([0, 0, 1000, 1]);
  view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);

  return {
    getCompressedView: (): CompressedView => {
      const start = view.to_origin + view.trace_view.x;
      const end = start + view.trace_view.width;
      const left = timeCompression.toCompressedOffset(start);
      const right = timeCompression.toCompressedOffset(end);

      return {
        left,
        right,
        width: Math.max(right - left, Number.EPSILON),
      };
    },
    getConfigSpacePerPx: (): number => {
      if (view.trace_physical_space.width === 0) {
        return spanToPx[0] || 1;
      }

      return view.trace_view.width / view.trace_physical_space.width;
    },
    spanMatrix: [1, 0, 0, 1, 0, 0] satisfies SpanMatrix,
    spanToPx,
    timeCompression,
    view,
  };
}

function makeCompressedContext(): TraceViewCalculationContext {
  return makeCalculationContext({
    timeCompression: TraceTimeCompression.FromVisibleItems({
      enabled: true,
      traceSpace: [0, 1000],
      physicalWidth: 1000,
      nodes: [
        {type: 'transaction', space: [0, 100]} as unknown as BaseNode,
        {type: 'span', space: [500, 100]} as unknown as BaseNode,
      ],
      indicators: [],
    }),
  });
}

describe('TraceViewCalculations', () => {
  describe('NormalTraceViewCalculations', () => {
    it('uses trace view duration for horizontal panning', () => {
      const calculations = new NormalTraceViewCalculations();
      const context = makeCalculationContext();

      context.view.setTraceView({x: 100, width: 200});

      expect(calculations.computeWheelPanView(context, 0.5)).toEqual({x: 200});
      expect(calculations.getConfigSpaceCursor(context, {x: 250, y: 0})).toEqual([
        150, 0,
      ]);
    });
  });

  describe('CompressedTraceViewCalculations', () => {
    it('keeps the cursor anchored when zooming through compressed time', () => {
      const calculations = new CompressedTraceViewCalculations();
      const context = makeCompressedContext();
      const cursorX = 165;
      const timestampBefore =
        calculations.getConfigSpaceCursor(context, {x: cursorX, y: 0})[0] +
        context.view.to_origin;

      const nextView = calculations.computeWheelZoomView(context, cursorX, 0.9);
      context.view.setTraceView({x: nextView[0], width: nextView[2]});

      const timestampAfter =
        calculations.getConfigSpaceCursor(context, {x: cursorX, y: 0})[0] +
        context.view.to_origin;

      expect(timestampAfter).toBeCloseTo(timestampBefore);
    });

    it('computes relative positions in compressed space', () => {
      const calculations = new CompressedTraceViewCalculations();
      const context = makeCompressedContext();

      expect(
        calculations.computeRelativeLeftPositionFromOrigin(context, 500, [0, 1000])
      ).not.toBe(0.5);
      expect(
        calculations.computeRelativeWidth(context, [100, 400], [0, 1000])
      ).toBeLessThan(0.4);
    });
  });
});
