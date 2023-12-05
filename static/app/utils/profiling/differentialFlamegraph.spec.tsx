import {DifferentialFlamegraph} from 'sentry/utils/profiling/differentialFlamegraph';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {SampledProfile} from 'sentry/utils/profiling/profile/sampledProfile';
import {createFrameIndex} from 'sentry/utils/profiling/profile/utils';

const schema: Profiling.Schema = {
  metadata: {} as Profiling.Schema['metadata'],
  profileID: '',
  profiles: [],
  projectID: 0,
  shared: {
    frames: [],
  },
};

const baseProfile: Profiling.SampledProfile = {
  endValue: 10,
  startValue: 0,
  name: '',
  threadID: 0,
  unit: 'nanoseconds',
  type: 'sampled',
  samples: [],
  weights: [],
};

const makeFlamegraph = (profile: Partial<Profiling.Schema>) => {
  const s: Profiling.Schema = {
    ...schema,
    ...profile,
  };

  const frameIndex = createFrameIndex('mobile', s.shared.frames);
  return new Flamegraph(
    SampledProfile.FromProfile(s.profiles[0] as Profiling.SampledProfile, frameIndex, {
      type: 'flamegraph',
    }),
    0,
    {
      inverted: false,
      sort: 'alphabetical',
    }
  );
};

const THEME = {
  COLORS: {
    DIFFERENTIAL_DECREASE: [0, 0, 1],
    DIFFERENTIAL_INCREASE: [1, 0, 0],
  },
} as FlamegraphTheme;

describe('differentialFlamegraph', () => {
  it('increase: color encodes new frames red', () => {
    const before = makeFlamegraph({
      shared: {
        frames: [{name: 'old function'}],
      },
      profiles: [
        {
          ...baseProfile,
          samples: [[0], [0]],
          weights: [1, 1],
        },
      ],
    });
    const current = makeFlamegraph({
      shared: {
        frames: [{name: 'new function'}],
      },
      profiles: [
        {
          ...baseProfile,
          samples: [[0], [0]],
          weights: [1, 1],
        },
      ],
    });

    const flamegraph = DifferentialFlamegraph.FromDiff({before, current}, THEME);

    expect(flamegraph.colors?.get('new function')).toEqual([
      ...THEME.COLORS.DIFFERENTIAL_INCREASE,
      1,
    ]);
  });

  it('sums weight across all stacks', () => {
    const before = makeFlamegraph({
      shared: {
        frames: [{name: 'function'}, {name: 'other function'}],
      },
      profiles: [
        {
          ...baseProfile,
          samples: [[0], [0, 1]],
          weights: [1, 2],
        },
      ],
    });
    const current = makeFlamegraph({
      shared: {
        frames: [{name: 'function'}, {name: 'other function'}],
      },
      profiles: [
        {
          ...baseProfile,
          samples: [[0], [1]],
          weights: [11, 4],
        },
      ],
    });

    const flamegraph = DifferentialFlamegraph.FromDiff({before, current}, THEME);

    expect(flamegraph.colors?.get('function')).toEqual([
      ...THEME.COLORS.DIFFERENTIAL_INCREASE,
      1,
    ]);
    expect(flamegraph.colors?.get('other function')).toEqual([
      ...THEME.COLORS.DIFFERENTIAL_INCREASE,
      0.2, // 2 / 10
    ]);
  });

  it('increase: color encodes increased frames red and relative to max change', () => {
    const before = makeFlamegraph({
      shared: {
        frames: [{name: 'function'}, {name: 'other function'}],
      },
      profiles: [
        {
          ...baseProfile,
          samples: [[0], [1]],
          weights: [1, 1],
        },
      ],
    });
    const current = makeFlamegraph({
      shared: {
        frames: [{name: 'function'}, {name: 'other function'}],
      },
      profiles: [
        {
          ...baseProfile,
          samples: [[0], [1]],
          weights: [11, 4],
        },
      ],
    });

    const flamegraph = DifferentialFlamegraph.FromDiff({before, current}, THEME);

    expect(flamegraph.colors?.get('function')).toEqual([
      ...THEME.COLORS.DIFFERENTIAL_INCREASE,
      1, // (11 - 1) / 10
    ]);
    expect(flamegraph.colors?.get('other function')).toEqual([
      ...THEME.COLORS.DIFFERENTIAL_INCREASE,
      0.3, // (4 - 1) / 10
    ]);
  });

  it('decrease: color encodes increased frames are blue and relative to max change', () => {
    const before = makeFlamegraph({
      shared: {
        frames: [{name: 'function'}, {name: 'other function'}],
      },
      profiles: [
        {
          ...baseProfile,
          samples: [[0], [1]],
          weights: [11, 4],
        },
      ],
    });
    const current = makeFlamegraph({
      shared: {
        frames: [{name: 'function'}, {name: 'other function'}],
      },
      profiles: [
        {
          ...baseProfile,
          samples: [[0], [1]],
          weights: [1, 2],
        },
      ],
    });

    const flamegraph = DifferentialFlamegraph.FromDiff({before, current}, THEME);

    expect(flamegraph.colors?.get('function')).toEqual([
      ...THEME.COLORS.DIFFERENTIAL_DECREASE,
      1,
    ]);
    expect(flamegraph.colors?.get('other function')).toEqual([
      ...THEME.COLORS.DIFFERENTIAL_DECREASE,
      0.2,
    ]);
  });
});
