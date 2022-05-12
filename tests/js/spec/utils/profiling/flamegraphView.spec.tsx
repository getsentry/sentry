import {vec2} from 'gl-matrix';

import {
  makeCanvasMock,
  makeContextMock,
  makeFlamegraph,
} from 'sentry-test/profiling/utils';

import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {LightFlamegraphTheme as theme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {FlamegraphView} from 'sentry/utils/profiling/flamegraphView';
import {Rect} from 'sentry/utils/profiling/gl/utils';

const makeCanvasAndView = (
  canvas: HTMLCanvasElement,
  flamegraph: Flamegraph,
  origin: vec2 = vec2.fromValues(0, 0)
) => {
  const flamegraphCanvas = new FlamegraphCanvas(canvas, origin);
  const flamegraphView = new FlamegraphView({
    canvas: flamegraphCanvas,
    flamegraph,
    theme,
  });

  return {flamegraphCanvas, flamegraphView};
};

describe('flamegraphView', () => {
  beforeEach(() => {
    // We simulate regular screens unless differently specified
    window.devicePixelRatio = 1;
  });

  describe('initializes', () => {
    it('initializes config space', () => {
      const canvas = makeCanvasMock();
      const flamegraph = makeFlamegraph();
      const {flamegraphView} = makeCanvasAndView(canvas, flamegraph);
      expect(flamegraphView.configSpace).toEqual(new Rect(0, 0, 10, 50));
    });

    it('initializes config view', () => {
      const canvas = makeCanvasMock();
      const flamegraph = makeFlamegraph();
      const {flamegraphView} = makeCanvasAndView(canvas, flamegraph);
      expect(flamegraphView.configView).toEqual(new Rect(0, 0, 10, 50));
    });

    it('initializes config view with insufficient height', () => {
      const canvas = makeCanvasMock({height: 100});
      const flamegraph = makeFlamegraph();
      const {flamegraphView} = makeCanvasAndView(canvas, flamegraph);
      // 20 pixels tall each, and canvas is 100 pixels tall
      expect(flamegraphView.configView).toEqual(new Rect(0, 0, 10, 5));
    });

    it('resizes config space and config view', () => {
      const canvas = makeCanvasMock({width: 200, height: 200});
      const flamegraph = makeFlamegraph();
      const {flamegraphCanvas, flamegraphView} = makeCanvasAndView(canvas, flamegraph);

      expect(flamegraphView.configSpace).toEqual(new Rect(0, 0, 10, 13));
      expect(flamegraphView.configView).toEqual(new Rect(0, 0, 10, 10));

      // make it smaller
      canvas.width = 100;
      canvas.height = 100;
      flamegraphCanvas.initPhysicalSpace();
      flamegraphView.resizeConfigSpace(flamegraphCanvas);

      expect(flamegraphView.configSpace).toEqual(new Rect(0, 0, 10, 13));
      expect(flamegraphView.configView).toEqual(new Rect(0, 0, 10, 5));

      // make it bigger
      canvas.width = 1000;
      canvas.height = 1000;
      flamegraphCanvas.initPhysicalSpace();
      flamegraphView.resizeConfigSpace(flamegraphCanvas);

      expect(flamegraphView.configSpace).toEqual(new Rect(0, 0, 10, 50));
      expect(flamegraphView.configView).toEqual(new Rect(0, 0, 10, 50));
    });
  });

  describe('getConfigSpaceCursor', () => {
    it('when view is not zoomed', () => {
      const canvas = makeCanvasMock({
        getContext: jest
          .fn()
          // @ts-ignore
          .mockReturnValue(makeContextMock({canvas: {width: 1000, height: 2000}})),
      });

      const flamegraph = makeFlamegraph({startValue: 0, endValue: 100});

      const {flamegraphCanvas, flamegraphView} = makeCanvasAndView(canvas, flamegraph);

      // x=250 is 1/4 of the width of the viewport, so it should map to flamegraph duration / 4
      // y=250 is at 1/8th the height of the viewport, so it should map to view height / 8
      const cursor = flamegraphView.getConfigSpaceCursor(
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
      const {flamegraphView} = makeCanvasAndView(canvas, flamegraph);
      flamegraphView.setConfigView(new Rect(0, 0, 10, 50));
      expect(flamegraphView.configView).toEqual(new Rect(0, 0, 500, 50));
    });

    it('does not allow zooming out more than the duration of a profile', () => {
      const {flamegraphView} = makeCanvasAndView(canvas, flamegraph);
      flamegraphView.setConfigView(new Rect(0, 0, 2000, 50));
      expect(flamegraphView.configView).toEqual(new Rect(0, 0, 1000, 50));
    });

    describe('edge detection on X axis', () => {
      it('is not zoomed in', () => {
        const {flamegraphView} = makeCanvasAndView(canvas, flamegraph);

        // Check that we cant go negative X from start of profile
        flamegraphView.setConfigView(new Rect(-100, 0, 1000, 50));
        expect(flamegraphView.configView).toEqual(new Rect(0, 0, 1000, 50));

        // Check that we cant go over X from end of profile
        flamegraphView.setConfigView(new Rect(2000, 0, 1000, 50));
        expect(flamegraphView.configView).toEqual(new Rect(0, 0, 1000, 50));
      });

      it('is zoomed in', () => {
        const {flamegraphView} = makeCanvasAndView(canvas, flamegraph);

        // Duration is is 1000, so we can't go over the end of the profile
        flamegraphView.setConfigView(new Rect(600, 0, 500, 50));
        expect(flamegraphView.configView).toEqual(new Rect(500, 0, 500, 50));
      });
    });

    describe('edge detection on Y axis', () => {
      it('is not zoomed in', () => {
        const {flamegraphView} = makeCanvasAndView(canvas, flamegraph);

        // Check that we cant go under stack height
        flamegraphView.setConfigView(new Rect(0, -50, 1000, 50));
        expect(flamegraphView.configView).toEqual(new Rect(0, 0, 1000, 50));

        // Check that we cant go over stack height
        flamegraphView.setConfigView(new Rect(0, 50, 1000, 50));
        expect(flamegraphView.configView).toEqual(new Rect(0, 0, 1000, 50));
      });

      it('is zoomed in', () => {
        const {flamegraphView} = makeCanvasAndView(canvas, flamegraph);

        // Check that we cant go over stack height
        flamegraphView.setConfigView(new Rect(0, 50, 1000, 25));
        expect(flamegraphView.configView).toEqual(new Rect(0, 25, 1000, 25));
      });
    });
  });
});
