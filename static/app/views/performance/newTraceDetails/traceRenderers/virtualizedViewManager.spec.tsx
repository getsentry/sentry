import {ThemeFixture} from 'sentry-fixture/theme';

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
      new TraceView(),
      ThemeFixture()
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
      new TraceView(),
      ThemeFixture()
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
        new TraceView(),
        ThemeFixture()
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
        new TraceView(),
        ThemeFixture()
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
        new TraceView(),
        ThemeFixture()
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
        new TraceView(),
        ThemeFixture()
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
          new TraceView(),
          ThemeFixture()
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
          new TraceView(),
          ThemeFixture()
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
        new TraceView(),
        ThemeFixture()
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
        new TraceView(),
        ThemeFixture()
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
        new TraceView(),
        ThemeFixture()
      );

      manager.view.setTraceSpace([100, 0, 1000, 1]);
      manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);
      manager.view.setTraceView({width: 500, x: 500});

      expect(Math.round(manager.transformXFromTimestamp(100))).toBe(-500);
    });
  });

  describe('horizontal scrolling', () => {
    describe('onWheel (timeline/span durations)', () => {
      it('scrolls horizontally with shift + vertical wheel', () => {
        const scheduler = new TraceScheduler();
        const manager = new VirtualizedViewManager(
          {
            list: {width: 0.5},
            span_list: {width: 0.5},
          },
          scheduler,
          new TraceView(),
          ThemeFixture()
        );

        manager.view.setTraceSpace([0, 0, 1000, 1]);
        manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 500, 1]);

        const initialX = manager.view.trace_view.x;

        // Simulate shift + vertical mouse wheel scroll (browser converts to horizontal)
        const wheelEvent = new WheelEvent('wheel', {
          deltaX: 50, // Browser converts shift+vertical to horizontal
          deltaY: 0,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        });

        let dispatchedView: {width?: number; x?: number} | null = null;
        scheduler.on('set trace view', (view: {width?: number; x?: number}) => {
          dispatchedView = view;
        });

        manager.onWheel(wheelEvent);

        expect(dispatchedView).not.toBeNull();
        expect(dispatchedView!.x).toBeGreaterThan(initialX);
      });

      it('scrolls horizontally with trackpad horizontal swipe', () => {
        const scheduler = new TraceScheduler();
        const manager = new VirtualizedViewManager(
          {
            list: {width: 0.5},
            span_list: {width: 0.5},
          },
          scheduler,
          new TraceView(),
          ThemeFixture()
        );

        manager.view.setTraceSpace([0, 0, 1000, 1]);
        manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 500, 1]);

        const initialX = manager.view.trace_view.x;

        // Simulate trackpad horizontal swipe
        const wheelEvent = new WheelEvent('wheel', {
          deltaX: 50,
          deltaY: 0,
          shiftKey: false,
          bubbles: true,
          cancelable: true,
        });

        let dispatchedView: {width?: number; x?: number} | null = null;
        scheduler.on('set trace view', (view: {width?: number; x?: number}) => {
          dispatchedView = view;
        });

        manager.onWheel(wheelEvent);

        expect(dispatchedView).not.toBeNull();
        expect(dispatchedView!.x).toBeGreaterThan(initialX);
      });

      it('does not scroll horizontally with vertical wheel (no shift)', () => {
        const scheduler = new TraceScheduler();
        const manager = new VirtualizedViewManager(
          {
            list: {width: 0.5},
            span_list: {width: 0.5},
          },
          scheduler,
          new TraceView(),
          ThemeFixture()
        );

        manager.view.setTraceSpace([0, 0, 1000, 1]);
        manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 500, 1]);

        // Simulate vertical mouse wheel scroll without shift
        const wheelEvent = new WheelEvent('wheel', {
          deltaX: 0,
          deltaY: 50,
          shiftKey: false,
          bubbles: true,
          cancelable: true,
        });

        let dispatchedView: {width?: number; x?: number} | null = null;
        scheduler.on('set trace view', (view: {width?: number; x?: number}) => {
          dispatchedView = view;
        });

        manager.onWheel(wheelEvent);

        // Should not dispatch for vertical-only scroll without shift
        expect(dispatchedView).not.toBeNull();
        expect(dispatchedView!.x).toBe(0);
      });
    });

    describe('onSyncedScrollbarScroll (span names list)', () => {
      it('scrolls horizontally with shift + vertical wheel', () => {
        const manager = new VirtualizedViewManager(
          {
            list: {width: 0.5},
            span_list: {width: 0.5},
          },
          new TraceScheduler(),
          new TraceView(),
          ThemeFixture()
        );

        manager.view.setTraceSpace([0, 0, 1000, 1]);
        manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 500, 1]);

        // Set up scrollable content (span names wider than container)
        manager.row_measurer.cache.set({id: 'test-node'} as any, 800);
        manager.row_measurer.max = 800;

        const initialTranslate = manager.columns.list.translate[0];

        // Simulate shift + vertical mouse wheel scroll (browser converts to horizontal)
        const wheelEvent = new WheelEvent('wheel', {
          deltaX: 50, // Browser converts shift+vertical to horizontal
          deltaY: 0,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        });

        manager.onSyncedScrollbarScroll(wheelEvent);

        // Should update the translate value to scroll left
        expect(manager.columns.list.translate[0]).toBeLessThan(initialTranslate);
      });

      it('scrolls horizontally with trackpad horizontal swipe', () => {
        const manager = new VirtualizedViewManager(
          {
            list: {width: 0.5},
            span_list: {width: 0.5},
          },
          new TraceScheduler(),
          new TraceView(),
          ThemeFixture()
        );

        manager.view.setTraceSpace([0, 0, 1000, 1]);
        manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 500, 1]);

        // Set up scrollable content
        manager.row_measurer.cache.set({id: 'test-node'} as any, 800);
        manager.row_measurer.max = 800;

        const initialTranslate = manager.columns.list.translate[0];

        // Simulate trackpad horizontal swipe
        const wheelEvent = new WheelEvent('wheel', {
          deltaX: 50,
          deltaY: 0,
          shiftKey: false,
          bubbles: true,
          cancelable: true,
        });

        manager.onSyncedScrollbarScroll(wheelEvent);

        expect(manager.columns.list.translate[0]).toBeLessThan(initialTranslate);
      });

      it('does not scroll when content fits within container', () => {
        const manager = new VirtualizedViewManager(
          {
            list: {width: 0.5},
            span_list: {width: 0.5},
          },
          new TraceScheduler(),
          new TraceView(),
          ThemeFixture()
        );

        manager.view.setTraceSpace([0, 0, 1000, 1]);
        manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 500, 1]);

        // Content fits within container (no overflow)
        manager.row_measurer.cache.set({id: 'test-node'} as any, 200);
        manager.row_measurer.max = 200;

        const initialTranslate = manager.columns.list.translate[0];

        const wheelEvent = new WheelEvent('wheel', {
          deltaX: 50,
          deltaY: 0,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        });

        manager.onSyncedScrollbarScroll(wheelEvent);

        // Should not scroll when there's no overflow
        expect(manager.columns.list.translate[0]).toBe(initialTranslate);
      });
    });
  });
});
