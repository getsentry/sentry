import {mat3, vec2} from 'gl-matrix';

import {makeCanvasMock, makeContextMock} from 'sentry-test/profiling/utils';

import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {Rect} from 'sentry/utils/profiling/speedscope';

describe('flamegraphCanvas', () => {
  beforeEach(() => {
    // We simulate regular screens unless differently specified
    window.devicePixelRatio = 1;
  });

  it('initializes physical space', () => {
    const canvas = makeCanvasMock();
    const flamegraphCanvas = new FlamegraphCanvas(canvas, vec2.fromValues(0, 0));
    expect(flamegraphCanvas.physicalSpace).toEqual(new Rect(0, 0, 1000, 1000));
  });

  it('initializes physical space with origin', () => {
    const canvas = makeCanvasMock();
    const flamegraphCanvas = new FlamegraphCanvas(canvas, vec2.fromValues(10, 10));
    expect(flamegraphCanvas.physicalSpace).toEqual(new Rect(10, 10, 990, 990));
  });

  it('initializes logical space', () => {
    window.devicePixelRatio = 2;
    const canvas = makeCanvasMock();
    const flamegraphCanvas = new FlamegraphCanvas(canvas, vec2.fromValues(0, 0));
    expect(flamegraphCanvas.logicalSpace).toEqual(new Rect(0, 0, 500, 500));
  });

  it('initializes logical space with origin', () => {
    window.devicePixelRatio = 2;
    const canvas = makeCanvasMock();
    const flamegraphCanvas = new FlamegraphCanvas(canvas, vec2.fromValues(10, 10));
    expect(flamegraphCanvas.logicalSpace).toEqual(new Rect(5, 5, 495, 495));
  });

  it('initializes logicalToPhysicalSpace', () => {
    window.devicePixelRatio = 2;
    // @ts-expect-error partial mock
    const context = makeContextMock({canvas: {width: 100, height: 100}});
    const canvas = makeCanvasMock({
      getContext: jest.fn().mockReturnValue(context),
    });

    const flamegraphCanvas = new FlamegraphCanvas(canvas, vec2.fromValues(10, 10));

    expect(flamegraphCanvas.logicalToPhysicalSpace).toEqual(
      mat3.fromScaling(mat3.create(), vec2.fromValues(2, 2))
    );
  });

  it('initializes physicalToLogicalSpace', () => {
    window.devicePixelRatio = 2;
    // @ts-expect-error partial mock
    const context = makeContextMock({canvas: {width: 100, height: 100}});
    const canvas = makeCanvasMock({
      getContext: jest.fn().mockReturnValue(context),
    });

    const flamegraphCanvas = new FlamegraphCanvas(canvas, vec2.fromValues(10, 10));

    expect(flamegraphCanvas.physicalToLogicalSpace).toEqual(
      mat3.fromScaling(mat3.create(), vec2.fromValues(0.5, 0.5))
    );
  });

  it('handles resize events by updating space', () => {
    const canvas = makeCanvasMock({
      width: 100,
      height: 100,
    });

    const flamegraphCanvas = new FlamegraphCanvas(canvas, vec2.fromValues(0, 0));

    expect(flamegraphCanvas.physicalSpace).toEqual(new Rect(0, 0, 100, 100));

    canvas.width = 200;
    canvas.height = 200;
    flamegraphCanvas.initPhysicalSpace();

    expect(flamegraphCanvas.physicalSpace).toEqual(new Rect(0, 0, 200, 200));
  });
});
