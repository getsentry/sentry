import {mat3} from 'gl-matrix';

import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {LightFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {Rect, trimTextCenter} from 'sentry/utils/profiling/gl/utils';
import {EventedProfile} from 'sentry/utils/profiling/profile/eventedProfile';
import {createFrameIndex} from 'sentry/utils/profiling/profile/utils';
import {isOutsideView, TextRenderer} from 'sentry/utils/profiling/renderers/textRenderer';

const makeBaseFlamegraph = (): Flamegraph => {
  const profile = EventedProfile.FromProfile(
    {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 1, frame: 1},
        {type: 'C', at: 2, frame: 1},
        {type: 'C', at: 3, frame: 0},
      ],
    },
    createFrameIndex([{name: 'f0'}, {name: 'f1'}])
  );

  return new Flamegraph(profile, 0, {inverted: false, leftHeavy: false});
};

describe('TextRenderer', () => {
  it('skips drawing if the text is outside the view', () => {
    const view = new Rect(0, 0, 1, 1);

    const frameLeftOutsideOfView = new Rect(-1.1, 0, 1, 1);
    const frameRightOutsideOfView = new Rect(1, 1.1, 1, 1);
    const frameAboveView = new Rect(0, -1.1, 1, 1);
    const frameBelowView = new Rect(0, 1.1, 1, 1);

    expect(isOutsideView(frameLeftOutsideOfView, view, false)).toBe(true);
    expect(isOutsideView(frameRightOutsideOfView, view, false)).toBe(true);
    expect(isOutsideView(frameAboveView, view, false)).toBe(true);
    expect(isOutsideView(frameBelowView, view, false)).toBe(true);
  });
  it('caches measure text', () => {
    const context: Partial<CanvasRenderingContext2D> = {
      measureText: jest.fn().mockReturnValue({width: 10}),
    };

    const canvas: Partial<HTMLCanvasElement> = {
      getContext: jest.fn().mockReturnValue(context),
    };

    const textRenderer = new TextRenderer(
      canvas as HTMLCanvasElement,
      makeBaseFlamegraph(),
      LightFlamegraphTheme
    );
    textRenderer.measureText(context as CanvasRenderingContext2D, 'text');
    textRenderer.measureText(context as CanvasRenderingContext2D, 'text');
    expect(context.measureText).toHaveBeenCalledTimes(1);
  });
  it('skips rendering node if it is not visible', () => {
    // Flamegraph looks like this
    // f0----f0 f2
    //    f1
    const profile = EventedProfile.FromProfile(
      {
        name: 'profile',
        startValue: 0,
        endValue: 1000,
        unit: 'milliseconds',
        type: 'evented',
        events: [
          {type: 'O', at: 0, frame: 0},
          {type: 'O', at: 100, frame: 1},
          {type: 'C', at: 200, frame: 1},
          {type: 'C', at: 300, frame: 0},
          {type: 'O', at: 300, frame: 2},
          {type: 'C', at: 400, frame: 2},
        ],
      },
      createFrameIndex([{name: 'f0'}, {name: 'f1'}, {name: 'f2'}])
    );

    const flamegraph = new Flamegraph(profile, 0, {inverted: false, leftHeavy: false});

    const context: Partial<CanvasRenderingContext2D> = {
      measureText: jest.fn().mockReturnValue({width: 10}),
      fillText: jest.fn(),
    };

    const canvas: Partial<HTMLCanvasElement> = {
      getContext: jest.fn().mockReturnValue(context),
    };

    const textRenderer = new TextRenderer(
      canvas as HTMLCanvasElement,
      flamegraph,
      LightFlamegraphTheme
    );

    textRenderer.draw(
      new Rect(0, 2.1, 200, 2),
      flamegraph.configSpace,
      mat3.identity(mat3.create())
    );

    expect(context.fillText).toHaveBeenCalledTimes(1);
    expect(context.fillText).toHaveBeenCalledWith(
      'f1',
      100 + LightFlamegraphTheme.SIZES.BAR_PADDING,
      // depth + 1 - half font size
      1 + 1 - LightFlamegraphTheme.SIZES.BAR_FONT_SIZE / 2 // center text vertically inside the rect
    );
  });
  it("trims output text if it doesn't fit", () => {
    const longFrameName =
      'very long frame name that needs to be truncated to fit the rect';
    const profile = EventedProfile.FromProfile(
      {
        name: 'profile',
        startValue: 0,
        endValue: 1000,
        unit: 'milliseconds',
        type: 'evented',
        events: [
          {type: 'O', at: 0, frame: 0},
          {type: 'C', at: longFrameName.length, frame: 0},
        ],
      },
      createFrameIndex([{name: longFrameName}])
    );

    const flamegraph = new Flamegraph(profile, 0, {inverted: false, leftHeavy: false});

    const context: Partial<CanvasRenderingContext2D> = {
      measureText: jest.fn().mockImplementation(n => {
        return {width: n.length - 1};
      }),
      fillText: jest.fn(),
    };

    const canvas: Partial<HTMLCanvasElement> = {
      getContext: jest.fn().mockReturnValue(context),
    };

    const textRenderer = new TextRenderer(
      canvas as HTMLCanvasElement,
      flamegraph,
      LightFlamegraphTheme
    );

    textRenderer.draw(
      new Rect(0, 0, Math.floor(longFrameName.length / 2), 10),
      flamegraph.configSpace,
      mat3.identity(mat3.create())
    );

    expect(context.fillText).toHaveBeenCalledTimes(1);
    expect(context.fillText).toHaveBeenCalledWith(
      trimTextCenter(
        longFrameName,
        Math.floor(longFrameName.length / 2) - LightFlamegraphTheme.SIZES.BAR_PADDING * 2
      ),
      LightFlamegraphTheme.SIZES.BAR_PADDING,
      1 - LightFlamegraphTheme.SIZES.BAR_FONT_SIZE / 2 // center text vertically inside the rect
    );
  });
  it('pins text to left and respects right boundary', () => {
    const longFrameName =
      'very long frame name that needs to be truncated to fit the rect';
    const profile = EventedProfile.FromProfile(
      {
        name: 'profile',
        startValue: 0,
        endValue: 1000,
        unit: 'milliseconds',
        type: 'evented',
        events: [
          {type: 'O', at: 0, frame: 0},
          {type: 'C', at: longFrameName.length, frame: 0},
        ],
      },
      createFrameIndex([{name: longFrameName}])
    );

    const flamegraph = new Flamegraph(profile, 0, {inverted: false, leftHeavy: false});

    const context: Partial<CanvasRenderingContext2D> = {
      measureText: jest.fn().mockImplementation(n => {
        return {width: n.length - 1};
      }),
      fillText: jest.fn(),
    };

    const canvas: Partial<HTMLCanvasElement> = {
      getContext: jest.fn().mockReturnValue(context),
    };

    const textRenderer = new TextRenderer(
      canvas as HTMLCanvasElement,
      flamegraph,
      LightFlamegraphTheme
    );

    textRenderer.draw(
      new Rect(
        Math.floor(longFrameName.length / 2),
        0,
        Math.floor(longFrameName.length / 2 / 2),
        10
      ),
      flamegraph.configSpace,
      mat3.identity(mat3.create())
    );

    expect(context.fillText).toHaveBeenCalledTimes(1);
    expect(context.fillText).toHaveBeenCalledWith(
      trimTextCenter(
        longFrameName,
        Math.floor(longFrameName.length / 2 / 2) -
          LightFlamegraphTheme.SIZES.BAR_PADDING * 2
      ),
      Math.floor(longFrameName.length / 2) + LightFlamegraphTheme.SIZES.BAR_PADDING,
      1 - LightFlamegraphTheme.SIZES.BAR_FONT_SIZE / 2 // center text vertically inside the rect
    );
  });
});
