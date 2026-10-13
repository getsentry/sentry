import {TraceView} from './traceView';

describe('TraceView', () => {
  it('does not allow setting trace view width to 0', () => {
    const view = new TraceView();

    view.setTraceView({width: 0});
    expect(view.trace_view.width).toBeGreaterThan(0);
  });

  describe('getConfigSpaceCursor', () => {
    it('returns the correct x position', () => {
      const view = new TraceView();

      view.setTraceSpace([0, 0, 100, 1]);
      view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);

      expect(view.getConfigSpaceCursor({x: 500, y: 0})).toEqual([50, 0]);
    });

    it('returns the correct x position when view scaled', () => {
      const view = new TraceView();

      view.setTraceSpace([0, 0, 100, 1]);
      view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);
      view.setTraceView({x: 50, width: 50});

      expect(view.getConfigSpaceCursor({x: 500, y: 0})).toEqual([75, 0]);
    });

    it('returns the correct x position when view is offset', () => {
      const view = new TraceView();

      view.setTraceSpace([0, 0, 100, 1]);
      view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);
      view.setTraceView({x: 50, width: 50});

      // Half of the right quadrant
      expect(view.getConfigSpaceCursor({x: 500, y: 0})).toEqual([75, 0]);
    });
  });
});
