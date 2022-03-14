import {LightFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {Rect, Transform} from 'sentry/utils/profiling/gl/utils';
import {
  computeInterval,
  getIntervalTimeAtX,
  GridRenderer,
} from 'sentry/utils/profiling/renderers/gridRenderer';

describe('getIntervalTimeAtX', () => {
  beforeEach(() => {
    window.devicePixelRatio = 1;
  });

  it('when origin is at 0', () => {
    const configView = new Rect(0, 0, 10, 10);
    const physicalSpace = new Rect(0, 0, 1000, 1000);

    const configToPhysical = Transform.transformMatrixBetweenRect(
      configView,
      physicalSpace
    );

    expect(getIntervalTimeAtX(configToPhysical, 500)).toBe(5);
  });
  it('when origin is offset', () => {
    const configView = new Rect(5, 0, 10, 10);
    const physicalSpace = new Rect(0, 0, 1000, 1000);

    const configToPhysical = Transform.transformMatrixBetweenRect(
      configView,
      physicalSpace
    );

    expect(getIntervalTimeAtX(configToPhysical, 500)).toBe(10);
  });

  it('high dpr - when origin is at 0', () => {
    window.devicePixelRatio = 2;
    const configView = new Rect(0, 0, 10, 10);
    const physicalSpace = new Rect(0, 0, 1000, 1000);

    const configToPhysical = Transform.transformMatrixBetweenRect(
      configView,
      physicalSpace
    );

    expect(getIntervalTimeAtX(configToPhysical, 500)).toBe(10);
  });
  it('high dpr - when origin is offset', () => {
    window.devicePixelRatio = 2;

    const configView = new Rect(5, 0, 10, 10);
    const physicalSpace = new Rect(0, 0, 1000, 1000);

    const configToPhysical = Transform.transformMatrixBetweenRect(
      configView,
      physicalSpace
    );

    expect(getIntervalTimeAtX(configToPhysical, 500)).toBe(15);
  });
});

describe('computeInterval', () => {
  beforeEach(() => {
    window.devicePixelRatio = 1;
  });
  it('computes intervals when origin is 0', () => {
    const configView = new Rect(0, 0, 100, 100);
    const physicalSpace = new Rect(0, 0, 1000, 1000);

    const configToPhysical = Transform.transformMatrixBetweenRect(
      configView,
      physicalSpace
    );

    expect(computeInterval(configView, configToPhysical)).toEqual([
      0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
    ]);
  });
  it('computes intervals when origin is offset', () => {
    const configView = new Rect(50, 0, 50, 100);
    const physicalSpace = new Rect(0, 0, 1000, 1000);

    const configToPhysical = Transform.transformMatrixBetweenRect(
      configView,
      physicalSpace
    );

    expect(computeInterval(configView, configToPhysical)).toEqual([
      50, 60, 70, 80, 90, 100,
    ]);
  });
  it('readjust intervals *5 when they are too small', () => {
    const configView = new Rect(60, 0, 40, 100);
    const physicalSpace = new Rect(0, 0, 1000, 1000);

    const configToPhysical = Transform.transformMatrixBetweenRect(
      configView,
      physicalSpace
    );

    expect(computeInterval(configView, configToPhysical)).toEqual([
      60, 65, 70, 75, 80, 85, 90, 95, 100,
    ]);
  });
  it('readjust intervals *2 when they are too small', () => {
    const configView = new Rect(80, 0, 20, 100);
    const physicalSpace = new Rect(0, 0, 1000, 1000);

    const configToPhysical = Transform.transformMatrixBetweenRect(
      configView,
      physicalSpace
    );

    expect(computeInterval(configView, configToPhysical)).toEqual([
      80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100,
    ]);
  });
  it('supports fractions', () => {
    const configView = new Rect(0, 0, 3, 100);
    const physicalSpace = new Rect(0, 0, 1000, 1000);

    const configToPhysical = Transform.transformMatrixBetweenRect(
      configView,
      physicalSpace
    );

    expect(computeInterval(configView, configToPhysical)).toEqual([
      0, 0.5, 1, 1.5, 2, 2.5, 3,
    ]);
  });
});

describe('gridRenderer', () => {
  it('draws each interval line', () => {
    // Mock the width of the measured text, we dont actually care if this is accurate or not
    const WIDTH = 20;

    const context: Partial<CanvasRenderingContext2D> = {
      fillText: jest.fn(),
      fillRect: jest.fn(),
      strokeRect: jest.fn(),
      measureText: jest.fn().mockReturnValue({width: WIDTH}),
    };
    const canvas: Partial<HTMLCanvasElement> = {
      getContext: jest.fn().mockReturnValue(context),
    };

    const renderer = new GridRenderer(
      canvas as HTMLCanvasElement,
      LightFlamegraphTheme,
      jest.fn().mockImplementation(n => n + 'ms')
    );

    const configView = new Rect(0, 0, 10, 100);
    const physicalSpace = new Rect(0, 0, 1000, 1000);

    const configToPhysical = Transform.transformMatrixBetweenRect(
      configView,
      physicalSpace
    );

    renderer.draw(configView, physicalSpace, configToPhysical);

    // Labels should be 0 - 10
    expect(context.fillRect).toHaveBeenCalledTimes(3);

    // @ts-ignore this is a mock
    for (let i = 0; i < context.fillText.mock.calls.length; i++) {
      // @ts-ignore this is a mock
      expect(context.fillText.mock.calls[i][0]).toEqual(i + 'ms');
      // @ts-ignore this is a mock
      expect(context.fillText.mock.calls[i][1]).toEqual(
        i * 100 - LightFlamegraphTheme.SIZES.LABEL_FONT_PADDING - WIDTH
      );
      // @ts-ignore this is a mock
      // First 3 draw calls are for the horizontal line, the rest are verticals
      expect(context.strokeRect.mock.calls[i][0]).toEqual(i * 100 - 0.5);
    }
  });
});
