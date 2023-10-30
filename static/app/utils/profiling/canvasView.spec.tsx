import {mat3, vec2} from 'gl-matrix';

import {
  makeCanvasMock,
  makeContextMock,
  makeFlamegraph,
} from 'sentry-test/profiling/utils';

import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {LightFlamegraphTheme as theme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {Rect} from 'sentry/utils/profiling/speedscope';

const makeCanvasAndView = (
  canvas: HTMLCanvasElement,
  flamegraph: Flamegraph,
  origin: vec2 = vec2.fromValues(0, 0),
  configSpaceTransform: Rect = Rect.Empty()
) => {
  const flamegraphCanvas = new FlamegraphCanvas(canvas, origin);
  const canvasView = new CanvasView<Flamegraph>({
    canvas: flamegraphCanvas,
    model: flamegraph,
    options: {
      inverted: flamegraph.inverted,
      minWidth: flamegraph.profile.minFrameDuration,
      barHeight: theme.SIZES.BAR_HEIGHT,
      depthOffset: theme.SIZES.FLAMEGRAPH_DEPTH_OFFSET,
      configSpaceTransform,
    },
  });

  return {flamegraphCanvas, view: canvasView};
};

describe('CanvasView', () => {
  beforeEach(() => {
    // We simulate regular screens unless differently specified
    window.devicePixelRatio = 1;
  });

  describe('initializes', () => {
    it('initializes config space', () => {
      const canvas = makeCanvasMock();
      const flamegraph = makeFlamegraph();
      const {view} = makeCanvasAndView(canvas, flamegraph);
      expect(view.configSpace).toEqual(new Rect(0, 0, 10, 50));
    });

    it('initializes config view', () => {
      const canvas = makeCanvasMock();
      const flamegraph = makeFlamegraph();
      const {view} = makeCanvasAndView(canvas, flamegraph);
      expect(view.configView).toEqual(new Rect(0, 0, 10, 50));
    });

    it('initializes config space transform', () => {
      const canvas = makeCanvasMock();
      const flamegraph = makeFlamegraph();
      const {view} = makeCanvasAndView(canvas, flamegraph);
      expect(mat3.exactEquals(view.configSpaceTransform, mat3.create())).toBe(true);
    });

    it('prevents invalid values on transform config space transform', () => {
      const canvas = makeCanvasMock();
      const flamegraph = makeFlamegraph();
      const {view} = makeCanvasAndView(
        canvas,
        flamegraph,
        undefined,
        new Rect(0, 0, 0, 0)
      );
      expect(mat3.exactEquals(view.configSpaceTransform, mat3.create())).toBe(true);
    });

    it('initializes config view with insufficient height', () => {
      const canvas = makeCanvasMock({height: 100});
      const flamegraph = makeFlamegraph();
      const {view} = makeCanvasAndView(canvas, flamegraph);
      // 20 pixels tall each, and canvas is 100 pixels tall
      expect(view.configView).toEqual(new Rect(0, 0, 10, 5));
    });

    it('resizes config space and config view', () => {
      const canvas = makeCanvasMock({width: 200, height: 200});
      const flamegraph = makeFlamegraph();
      const {flamegraphCanvas, view} = makeCanvasAndView(canvas, flamegraph);

      expect(view.configSpace).toEqual(new Rect(0, 0, 10, 12));
      expect(view.configView).toEqual(new Rect(0, 0, 10, 10));

      // make it smaller
      canvas.width = 100;
      canvas.height = 100;
      flamegraphCanvas.initPhysicalSpace();
      view.resizeConfigSpace(flamegraphCanvas);

      expect(view.configSpace).toEqual(new Rect(0, 0, 10, 12));
      expect(view.configView).toEqual(new Rect(0, 0, 10, 5));

      // make it bigger
      canvas.width = 1000;
      canvas.height = 1000;
      flamegraphCanvas.initPhysicalSpace();
      view.resizeConfigSpace(flamegraphCanvas);

      expect(view.configSpace).toEqual(new Rect(0, 0, 10, 50));
      expect(view.configView).toEqual(new Rect(0, 0, 10, 50));
    });
  });

  describe('getConfigSpaceCursor', () => {
    it('when view is not zoomed', () => {
      const canvas = makeCanvasMock({
        getContext: jest
          .fn()
          // @ts-expect-error
          .mockReturnValue(makeContextMock({canvas: {width: 1000, height: 2000}})),
      });

      const flamegraph = makeFlamegraph({startValue: 0, endValue: 100});

      const {flamegraphCanvas, view} = makeCanvasAndView(canvas, flamegraph);

      // x=250 is 1/4 of the width of the viewport, so it should map to flamegraph duration / 4
      // y=250 is at 1/8th the height of the viewport, so it should map to view height / 8
      const cursor = view.getConfigSpaceCursor(
        vec2.fromValues(250, 250),
        flamegraphCanvas
      );
      expect(cursor).toEqual(vec2.fromValues(25, 2000 / theme.SIZES.BAR_HEIGHT / 8));
    });
  });

  describe('setConfigView', () => {
    const canvas = makeCanvasMock();
    const flamegraph = makeFlamegraph(
      {
        startValue: 0,
        endValue: 1000,
        events: [
          {type: 'O', frame: 0, at: 0},
          {type: 'C', frame: 0, at: 500},
        ],
      },
      [{name: 'f0'}]
    );

    it('does not allow zooming in more than the min width of a frame', () => {
      const {view} = makeCanvasAndView(canvas, flamegraph);
      view.setConfigView(new Rect(0, 0, 10, 50));
      expect(view.configView).toEqual(new Rect(0, 0, 500, 50));
    });

    it('does not allow zooming out more than the duration of a profile', () => {
      const {view} = makeCanvasAndView(canvas, flamegraph);
      view.setConfigView(new Rect(0, 0, 2000, 50));
      expect(view.configView).toEqual(new Rect(0, 0, 1000, 50));
    });

    describe('edge detection on X axis', () => {
      it('is not zoomed in', () => {
        const {view} = makeCanvasAndView(canvas, flamegraph);

        // Check that we cant go negative X from start of profile
        view.setConfigView(new Rect(-100, 0, 1000, 50));
        expect(view.configView).toEqual(new Rect(0, 0, 1000, 50));

        // Check that we cant go over X from end of profile
        view.setConfigView(new Rect(2000, 0, 1000, 50));
        expect(view.configView).toEqual(new Rect(0, 0, 1000, 50));
      });

      it('is zoomed in', () => {
        const {view} = makeCanvasAndView(canvas, flamegraph);

        // Duration is is 1000, so we can't go over the end of the profile
        view.setConfigView(new Rect(600, 0, 500, 50));
        expect(view.configView).toEqual(new Rect(500, 0, 500, 50));
      });
    });

    describe('edge detection on Y axis', () => {
      it('is not zoomed in', () => {
        const {view} = makeCanvasAndView(canvas, flamegraph);

        // Check that we cant go under stack height
        view.setConfigView(new Rect(0, -50, 1000, 50));
        expect(view.configView).toEqual(new Rect(0, 0, 1000, 50));

        // Check that we cant go over stack height
        view.setConfigView(new Rect(0, 50, 1000, 50));
        expect(view.configView).toEqual(new Rect(0, 0, 1000, 50));
      });

      it('is zoomed in', () => {
        const {view} = makeCanvasAndView(canvas, flamegraph);

        // Check that we cant go over stack height
        view.setConfigView(new Rect(0, 50, 1000, 25));
        expect(view.configView).toEqual(new Rect(0, 25, 1000, 25));
      });
    });
  });

  describe('configSpaceTransform', () => {
    it('initializes transform matrix', () => {
      const canvas = makeCanvasMock({width: 1000, height: 1000});
      const flamegraph = makeFlamegraph(
        {
          startValue: 0,
          endValue: 1000,
          events: [
            {type: 'O', frame: 0, at: 0},
            {type: 'C', frame: 0, at: 1000},
          ],
        },
        [{name: 'f0'}]
      );
      const {view} = makeCanvasAndView(
        canvas,
        flamegraph,
        vec2.fromValues(0, 0),
        new Rect(500, 0, 0, 0)
      );

      expect(view.configSpace).toEqual(new Rect(0, 0, 1000, 50));
      expect(
        mat3.exactEquals(
          view.configSpaceTransform,
          mat3.fromValues(1, 0, 0, 0, 1, 0, 500, 0, 1)
        )
      ).toBe(true);
    });
    it('fromTransformedConfigView', () => {
      const canvas = makeCanvasMock({width: 1000, height: 1000});
      const flamegraph = makeFlamegraph({
        startValue: 0,
        endValue: 1000,
        events: [],
      });
      const {view} = makeCanvasAndView(
        canvas,
        flamegraph,
        vec2.fromValues(0, 0),
        new Rect(500, 0, 0, 0)
      );

      // Our frame origin is at 0, but we expect it to be at
      // 500 because of the configSpaceTransform
      const frame = new Rect(0, 0, 1000, 1).transformRect(
        view.fromTransformedConfigView(new Rect(0, 0, 1000, 1000))
      );

      expect(frame.width).toBe(1000);
      expect(frame.x).toBe(500);

      expect(
        // x is 2x scale,
        mat3.exactEquals(
          view.fromTransformedConfigView(new Rect(0, 0, 1000, 1000)),
          mat3.fromValues(1, 0, 0, 0, 20, 0, 500, 0, 1)
        )
      ).toBe(true);
    });

    it('fromTransformedConfigSpace', () => {
      const canvas = makeCanvasMock({width: 1000, height: 1000});
      const flamegraph = makeFlamegraph(
        {
          startValue: 0,
          endValue: 1000,
          events: [
            {type: 'O', frame: 0, at: 0},
            {type: 'C', frame: 0, at: 1000},
          ],
        },
        [{name: 'f0'}]
      );
      const {view} = makeCanvasAndView(
        canvas,
        flamegraph,
        vec2.fromValues(0, 0),
        new Rect(500, 0, 0, 0)
      );

      // we simulate config view change and expect the same result
      view.setConfigView(new Rect(0, 0, 10, 1000));
      const frame = new Rect(0, 0, 1000, 1).transformRect(
        view.fromTransformedConfigSpace(new Rect(0, 0, 1000, 1000))
      );

      expect(frame.width).toBe(1000);
      expect(frame.x).toBe(500);

      expect(
        // x is 2x scale,
        mat3.exactEquals(
          view.fromTransformedConfigSpace(new Rect(0, 0, 1000, 1000)),
          mat3.fromValues(1, 0, 0, 0, 20, 0, 500, 0, 1)
        )
      ).toBe(true);
    });
    it('getTransformedConfigSpaceCursor', () => {
      const canvas = makeCanvasMock({width: 1000, height: 1000});
      const flamegraph = makeFlamegraph(
        {
          startValue: 0,
          endValue: 1000,
          events: [
            {type: 'O', frame: 0, at: 0},
            {type: 'C', frame: 0, at: 1000},
          ],
        },
        [{name: 'f0'}]
      );
      const {flamegraphCanvas, view} = makeCanvasAndView(
        canvas,
        flamegraph,
        vec2.fromValues(0, 0),
        new Rect(500, 0, 0, 0)
      );

      // we simulate config view change and expect the same result
      view.setConfigView(new Rect(0, 0, 10, 1000));

      const cursor = view.getTransformedConfigSpaceCursor(
        vec2.fromValues(500, 500),
        flamegraphCanvas
      );
      // 500 - 500 offset = 0
      expect(cursor[0]).toEqual(0);
      expect(cursor[1]).toEqual(25);
    });
    it('getTransformedConfigViewCursor', () => {
      const canvas = makeCanvasMock({width: 1000, height: 1000});
      const flamegraph = makeFlamegraph({
        startValue: 0,
        endValue: 2000,
        events: [
          {type: 'O', frame: 0, at: 0},
          {type: 'C', frame: 0, at: 10},
        ],
      });
      const {flamegraphCanvas, view} = makeCanvasAndView(
        canvas,
        flamegraph,
        vec2.fromValues(0, 0),
        new Rect(100, 0, 0, 0)
      );

      view.setConfigView(new Rect(200, 0, 1000, 50));

      // middle of screen at
      // 200-100 at half screen of 1000 = 600
      const cursor = view.getTransformedConfigViewCursor(
        vec2.fromValues(500, 500),
        flamegraphCanvas
      );

      expect(cursor[0]).toEqual(600);
      expect(cursor[1]).toEqual(25);
    });
  });
});
