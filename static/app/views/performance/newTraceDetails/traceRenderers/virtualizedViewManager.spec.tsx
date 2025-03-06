import {TraceScheduler} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceScheduler';
import {TraceView} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceView';
import {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';

describe('VirtualizedViewManger', () => {
  it('initializes space', () => {
    const manager = new VirtualizedViewManager(
      {
        list: {width: 0.5},
        span_list: {width: 0.5},
      },
      new TraceScheduler(),
      new TraceView()
    );

    manager.view.setTraceSpace([10_000, 0, 1000, 1]);

    expect(manager.view.trace_space.serialize()).toEqual([0, 0, 1000, 1]);
    expect(manager.view.trace_view.serialize()).toEqual([0, 0, 1000, 1]);
  });

  it('initializes physical space', () => {
    const manager = new VirtualizedViewManager(
      {
        list: {width: 0.5},
        span_list: {width: 0.5},
      },
      new TraceScheduler(),
      new TraceView()
    );

    manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 500, 1]);

    expect(manager.view.trace_container_physical_space.serialize()).toEqual([
      0, 0, 1000, 1,
    ]);
    expect(manager.view.trace_physical_space.serialize()).toEqual([0, 0, 500, 1]);
  });

  describe('computeSpanCSSMatrixTransform', () => {
    it('enforces min scaling', () => {
      const manager = new VirtualizedViewManager(
        {
          list: {width: 0},
          span_list: {width: 1},
        },
        new TraceScheduler(),
        new TraceView()
      );

      manager.view.setTraceSpace([0, 0, 1000, 1]);
      manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);

      expect(manager.computeSpanCSSMatrixTransform([0, 0.1])).toEqual([
        0.001, 0, 0, 1, 0, 0,
      ]);
    });
    it('computes width scaling correctly', () => {
      const manager = new VirtualizedViewManager(
        {
          list: {width: 0},
          span_list: {width: 1},
        },
        new TraceScheduler(),
        new TraceView()
      );

      manager.view.setTraceSpace([0, 0, 100, 1]);
      manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);

      expect(manager.computeSpanCSSMatrixTransform([0, 100])).toEqual([1, 0, 0, 1, 0, 0]);
    });

    it('computes x position correctly', () => {
      const manager = new VirtualizedViewManager(
        {
          list: {width: 0},
          span_list: {width: 1},
        },
        new TraceScheduler(),
        new TraceView()
      );

      manager.view.setTraceSpace([0, 0, 1000, 1]);
      manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);

      expect(manager.computeSpanCSSMatrixTransform([50, 1000])).toEqual([
        1, 0, 0, 1, 50, 0,
      ]);
    });

    it('computes span x position correctly', () => {
      const manager = new VirtualizedViewManager(
        {
          list: {width: 0},
          span_list: {width: 1},
        },
        new TraceScheduler(),
        new TraceView()
      );

      manager.view.setTraceSpace([0, 0, 1000, 1]);
      manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);

      expect(manager.computeSpanCSSMatrixTransform([50, 1000])).toEqual([
        1, 0, 0, 1, 50, 0,
      ]);
    });

    describe('when start is not 0', () => {
      it('computes width scaling correctly', () => {
        const manager = new VirtualizedViewManager(
          {
            list: {width: 0},
            span_list: {width: 1},
          },
          new TraceScheduler(),
          new TraceView()
        );

        manager.view.setTraceSpace([100, 0, 100, 1]);
        manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);

        expect(manager.computeSpanCSSMatrixTransform([100, 100])).toEqual([
          1, 0, 0, 1, 0, 0,
        ]);
      });
      it('computes x position correctly when view is offset', () => {
        const manager = new VirtualizedViewManager(
          {
            list: {width: 0},
            span_list: {width: 1},
          },
          new TraceScheduler(),
          new TraceView()
        );

        manager.view.setTraceSpace([100, 0, 100, 1]);
        manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);

        expect(manager.computeSpanCSSMatrixTransform([100, 100])).toEqual([
          1, 0, 0, 1, 0, 0,
        ]);
      });
    });
  });

  describe('transformXFromTimestamp', () => {
    it('computes x position correctly', () => {
      const manager = new VirtualizedViewManager(
        {
          list: {width: 0},
          span_list: {width: 1},
        },
        new TraceScheduler(),
        new TraceView()
      );

      manager.view.setTraceSpace([0, 0, 1000, 1]);
      manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);

      expect(manager.transformXFromTimestamp(50)).toBe(50);
    });

    it('computes x position correctly when view is offset', () => {
      const manager = new VirtualizedViewManager(
        {
          list: {width: 0},
          span_list: {width: 1},
        },
        new TraceScheduler(),
        new TraceView()
      );

      manager.view.setTraceSpace([50, 0, 1000, 1]);
      manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);

      manager.view.trace_view.x = 50;

      expect(manager.transformXFromTimestamp(-50)).toBe(-150);
    });

    it('when view is offset and scaled', () => {
      const manager = new VirtualizedViewManager(
        {
          list: {width: 0},
          span_list: {width: 1},
        },
        new TraceScheduler(),
        new TraceView()
      );

      manager.view.setTraceSpace([100, 0, 1000, 1]);
      manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);
      manager.view.setTraceView({width: 500, x: 500});

      expect(Math.round(manager.transformXFromTimestamp(100))).toBe(-500);
    });
  });
});
