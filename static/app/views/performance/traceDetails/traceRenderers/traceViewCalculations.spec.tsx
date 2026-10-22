import {mat3} from 'gl-matrix';

import type {BaseNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/baseNode';
import {TraceTimeCompression} from 'sentry/views/performance/traceDetails/traceRenderers/traceTimeCompression';
import {TraceView} from 'sentry/views/performance/traceDetails/traceRenderers/traceView';
import {
  CompressedTraceViewCalculations,
  NormalTraceViewCalculations,
  type CompressedView,
  type SpanMatrix,
  type TraceViewCalculationContext,
} from 'sentry/views/performance/traceDetails/traceRenderers/traceViewCalculations';

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
    it('pads a zoom target independently of the current viewport', () => {
      const calculations = new NormalTraceViewCalculations();
      const context = makeCalculationContext();

      for (const viewport of [
        {x: 0, width: 1000},
        {x: 495, width: 10},
      ]) {
        context.view.setTraceView(viewport);
        calculations.recomputeSpanToPXMatrix(context);

        const padded = calculations.padZoomIntoSpace(context, 500, 1);
        expect(padded.x).toBeCloseTo(499.926);
        expect(padded.width).toBeCloseTo(1.148);
      }
    });

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
    describe.each([0, 10_000])('horizontal panning with trace origin %s', origin => {
      let context: TraceViewCalculationContext;
      const calculations = new CompressedTraceViewCalculations();

      beforeEach(() => {
        context = makeCalculationContext({
          timeCompression: TraceTimeCompression.FromVisibleItems({
            enabled: true,
            traceSpace: [origin, 1000],
            physicalWidth: 1000,
            nodes: [
              {type: 'span', space: [origin, 100]} as BaseNode,
              {type: 'span', space: [origin + 900, 100]} as BaseNode,
            ],
            indicators: [],
          }),
        });
        context.view.setTraceSpace([origin, 0, 1000, 1]);
      });

      it.each([
        {name: 'at the left boundary', x: 0, width: 500, delta: -0.1},
        {name: 'at the right boundary', x: 500, width: 500, delta: 0.1},
        {name: 'past the left boundary', x: 100, width: 400, delta: -10},
        {name: 'past the right boundary', x: 500, width: 400, delta: 10},
        {name: 'left with the full trace visible', x: 0, width: 1000, delta: -0.1},
        {name: 'right with the full trace visible', x: 0, width: 1000, delta: 0.1},
      ])('preserves zoom when panning $name', ({x, width, delta}) => {
        context.view.setTraceView({x, width});
        const compressedWidth = context.getCompressedView().width;

        for (let pan = 0; pan < 2; pan++) {
          context.view.setTraceView(calculations.computeWheelPanView(context, delta));

          expect(context.getCompressedView().width).toBeCloseTo(compressedWidth);
          if (delta < 0) {
            expect(context.view.trace_view.x).toBeCloseTo(0);
          } else {
            expect(context.view.trace_view.right).toBeCloseTo(1000);
          }
        }
      });

      it.each([
        {x: 100, delta: 0.1},
        {x: 500, delta: -0.1},
      ])('preserves zoom when panning within bounds from $x', ({x, delta}) => {
        context.view.setTraceView({x, width: 400});
        const before = context.getCompressedView();

        context.view.setTraceView(calculations.computeWheelPanView(context, delta));

        const after = context.getCompressedView();
        expect(after.width).toBeCloseTo(before.width);
        expect(after.left).toBeCloseTo(before.left + delta * before.width);
      });
    });

    it.each([
      {x: 500, width: 1},
      {x: 147, width: 1},
      {x: 452, width: 1},
      {x: 100, width: 400},
    ])(
      'keeps zooming to [$x, $width] stable across viewports and repeated zooms',
      target => {
        const calculations = new CompressedTraceViewCalculations();
        const context = makeCompressedContext();
        calculations.recomputeSpanToPXMatrix(context);
        const expected = calculations.padZoomIntoSpace(context, target.x, target.width);

        for (const viewport of [{x: 495, width: 10}, expected]) {
          context.view.setTraceView(viewport);
          calculations.recomputeSpanToPXMatrix(context);

          expect(calculations.padZoomIntoSpace(context, target.x, target.width)).toEqual(
            expected
          );
        }

        context.view.setTraceView(expected);
        calculations.recomputeSpanToPXMatrix(context);
        const startPx = calculations.transformXFromTimestamp(context, target.x);
        const endPx = calculations.transformXFromTimestamp(
          context,
          target.x + target.width
        );

        expect(startPx).toBeCloseTo(64.46, 1);
        expect(endPx - startPx).toBeCloseTo(871.08, 1);
        expect(1000 - endPx).toBeCloseTo(64.46, 1);
      }
    );

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
