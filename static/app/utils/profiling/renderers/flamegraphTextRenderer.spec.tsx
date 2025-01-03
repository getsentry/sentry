import {mat3} from 'gl-matrix';

import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {LightFlamegraphTheme as Theme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {EventedProfile} from 'sentry/utils/profiling/profile/eventedProfile';
import {createFrameIndex} from 'sentry/utils/profiling/profile/utils';
import {FlamegraphTextRenderer} from 'sentry/utils/profiling/renderers/flamegraphTextRenderer';
import {Rect, trimTextCenter} from 'sentry/utils/profiling/speedscope';

const makeBaseFlamegraph = (): Flamegraph => {
  const profile = EventedProfile.FromProfile(
    {
      name: 'profile',
      startValue: 0,
      threadID: 0,
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
    createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}]),
    {type: 'flamechart'}
  );

  return new Flamegraph(profile, {inverted: false, sort: 'call order'});
};

describe('TextRenderer', () => {
  it('invalidates cache if cached measurements do not match new measurements', () => {
    const context: Partial<CanvasRenderingContext2D> = {
      measureText: jest
        .fn()
        .mockReturnValueOnce({width: 1}) // first call for test
        .mockReturnValueOnce({width: 10})
        .mockReturnValueOnce({width: 20}),
    };

    const canvas: Partial<HTMLCanvasElement> = {
      getContext: jest.fn().mockReturnValue(context),
    };

    const textRenderer = new FlamegraphTextRenderer(
      canvas as HTMLCanvasElement,
      Theme,
      makeBaseFlamegraph()
    );

    textRenderer.measureAndCacheText('test');

    textRenderer.maybeInvalidateCache();
    textRenderer.maybeInvalidateCache();

    expect(textRenderer.textCache.test).toBeUndefined();
    expect(textRenderer.textCache).toEqual({
      'Who knows if this changed, font-display: swap wont tell me': {
        width: 20,
      },
    });
  });
  it('caches measure text', () => {
    const context: Partial<CanvasRenderingContext2D> = {
      measureText: jest.fn().mockReturnValue({width: 10}),
    };

    const canvas: Partial<HTMLCanvasElement> = {
      getContext: jest.fn().mockReturnValue(context),
    };

    const textRenderer = new FlamegraphTextRenderer(
      canvas as HTMLCanvasElement,
      Theme,
      makeBaseFlamegraph()
    );
    textRenderer.measureAndCacheText('text');
    textRenderer.measureAndCacheText('text');
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
        threadID: 0,
        events: [
          {type: 'O', at: 0, frame: 0},
          {type: 'O', at: 100, frame: 1},
          {type: 'C', at: 200, frame: 1},
          {type: 'C', at: 300, frame: 0},
          {type: 'O', at: 300, frame: 2},
          {type: 'C', at: 400, frame: 2},
        ],
      },
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}, {name: 'f2'}]),
      {type: 'flamechart'}
    );

    const flamegraph = new Flamegraph(profile, {inverted: false, sort: 'call order'});

    const context: Partial<CanvasRenderingContext2D> = {
      measureText: jest.fn().mockReturnValue({width: 10}),
      fillText: jest.fn(),
    };

    const canvas: Partial<HTMLCanvasElement> = {
      getContext: jest.fn().mockReturnValue(context),
    };

    const textRenderer = new FlamegraphTextRenderer(
      canvas as HTMLCanvasElement,
      Theme,
      flamegraph
    );

    textRenderer.draw(new Rect(0, 0, 200, 2), mat3.create(), new Map());

    expect(context.fillText).toHaveBeenCalledTimes(2);
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
        threadID: 0,
        events: [
          {type: 'O', at: 0, frame: 0},
          {type: 'C', at: longFrameName.length, frame: 0},
        ],
      },
      createFrameIndex('mobile', [{name: longFrameName}]),
      {type: 'flamechart'}
    );

    const flamegraph = new Flamegraph(profile, {inverted: false, sort: 'call order'});

    const context: Partial<CanvasRenderingContext2D> = {
      measureText: jest.fn().mockImplementation(n => {
        return {width: n.length - 1};
      }),
      fillText: jest.fn(),
    };

    const canvas: Partial<HTMLCanvasElement> = {
      getContext: jest.fn().mockReturnValue(context),
    };

    const textRenderer = new FlamegraphTextRenderer(
      canvas as HTMLCanvasElement,
      Theme,
      flamegraph
    );

    textRenderer.draw(
      new Rect(0, 0, Math.floor(longFrameName.length / 2), 10),
      mat3.create(),
      new Map()
    );

    expect(context.fillText).toHaveBeenCalledTimes(1);
    expect(context.fillText).toHaveBeenCalledWith(
      trimTextCenter(
        longFrameName,
        Math.floor(longFrameName.length / 2) - Theme.SIZES.BAR_PADDING * 2
      ).text,
      Theme.SIZES.BAR_PADDING,
      Theme.SIZES.BAR_HEIGHT - Theme.SIZES.BAR_FONT_SIZE / 2 // center text vertically inside the rect
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
        threadID: 0,
        events: [
          {type: 'O', at: 0, frame: 0},
          {type: 'C', at: longFrameName.length, frame: 0},
        ],
      },
      createFrameIndex('mobile', [{name: longFrameName}]),
      {type: 'flamechart'}
    );

    const flamegraph = new Flamegraph(profile, {inverted: false, sort: 'call order'});

    const context: Partial<CanvasRenderingContext2D> = {
      measureText: jest.fn().mockImplementation(n => {
        return {width: n.length - 1};
      }),
      fillText: jest.fn(),
    };

    const canvas: Partial<HTMLCanvasElement> = {
      getContext: jest.fn().mockReturnValue(context),
    };

    const textRenderer = new FlamegraphTextRenderer(
      canvas as HTMLCanvasElement,
      Theme,
      flamegraph
    );

    textRenderer.draw(
      new Rect(
        Math.floor(longFrameName.length / 2),
        0,
        Math.floor(longFrameName.length / 2 / 2),
        10
      ),
      mat3.create(),
      new Map()
    );

    expect(context.fillText).toHaveBeenCalledTimes(1);
    expect(context.fillText).toHaveBeenCalledWith(
      trimTextCenter(
        longFrameName,
        Math.floor(longFrameName.length / 2 / 2) - Theme.SIZES.BAR_PADDING * 2
      ).text,
      Math.floor(longFrameName.length / 2) + Theme.SIZES.BAR_PADDING,
      Theme.SIZES.BAR_HEIGHT - Theme.SIZES.BAR_FONT_SIZE / 2 // center text vertically inside the rect
    );
  });
});
