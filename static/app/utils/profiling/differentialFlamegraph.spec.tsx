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
    FRAME_FALLBACK_COLOR: [0, 0, 0, 0],
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
    const after = makeFlamegraph({
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

    const flamegraph = DifferentialFlamegraph.FromDiff(
      {before, after},
      {negated: false},
      THEME
    );

    expect(flamegraph.newFrames?.length).toBe(1);
    expect([...flamegraph.colors.values()][0]).toEqual([
      ...THEME.COLORS.DIFFERENTIAL_INCREASE,
      1 * DifferentialFlamegraph.ALPHA_SCALING,
    ]);
  });

  it('increase: color encodes new frames red with multiple children', () => {
    const before = makeFlamegraph({
      shared: {
        frames: [{name: 'function'}, {name: 'sibling1'}, {name: 'sibling2'}],
      },
      profiles: [
        {
          ...baseProfile,
          samples: [
            [0, 1],
            [0, 2],
          ],
          weights: [1, 1],
        },
      ],
    });
    const after = makeFlamegraph({
      shared: {
        frames: [{name: 'function'}, {name: 'sibling1'}, {name: 'sibling2'}],
      },
      profiles: [
        {
          ...baseProfile,
          samples: [
            [0, 1],
            [0, 2],
          ],
          weights: [5, 5],
        },
      ],
    });

    const flamegraph = DifferentialFlamegraph.FromDiff(
      {before, after},
      {negated: false},
      THEME
    );

    expect(flamegraph.newFrames?.length).toBe(0);
    expect(flamegraph.removedFrames?.length).toBe(0);

    expect([...flamegraph.colors.values()][2]).toEqual([
      ...THEME.COLORS.DIFFERENTIAL_INCREASE,
      1 * DifferentialFlamegraph.ALPHA_SCALING,
    ]);
  });

  it('tracks removed frames when a section of the tree is removed', () => {
    const before = makeFlamegraph({
      shared: {
        frames: [{name: 'function'}, {name: 'removed function'}],
      },
      profiles: [
        {
          ...baseProfile,
          samples: [[0], [0, 1]],
          weights: [1, 1],
        },
      ],
    });
    const after = makeFlamegraph({
      shared: {
        frames: [{name: 'function'}],
      },
      profiles: [
        {
          ...baseProfile,
          samples: [[0], [0]],
          weights: [1, 1],
        },
      ],
    });

    const flamegraph = DifferentialFlamegraph.FromDiff(
      {before, after},
      {negated: false},
      THEME
    );

    expect(flamegraph.removedFrames?.length).toBe(1);
    expect(flamegraph.removedFrames?.[0].frame.name).toBe('removed function');
    expect([...flamegraph.colors.values()][0]).toEqual([
      ...THEME.COLORS.DIFFERENTIAL_DECREASE,
      1 * DifferentialFlamegraph.ALPHA_SCALING,
    ]);
  });

  it('tracks removed frames when a is removed', () => {
    const before = makeFlamegraph({
      shared: {
        frames: [{name: 'function'}, {name: 'removed function'}],
      },
      profiles: [
        {
          ...baseProfile,
          samples: [[0], [1]],
          weights: [1, 1],
        },
      ],
    });
    const after = makeFlamegraph({
      shared: {
        frames: [{name: 'function'}],
      },
      profiles: [
        {
          ...baseProfile,
          samples: [[0], [0]],
          weights: [1, 1],
        },
      ],
    });

    const flamegraph = DifferentialFlamegraph.FromDiff(
      {before, after},
      {negated: false},
      THEME
    );

    expect(flamegraph.removedFrames?.length).toBe(1);
    expect(flamegraph.removedFrames?.[0].frame.name).toBe('removed function');
    expect([...flamegraph.colors.values()][0]).toEqual([
      ...THEME.COLORS.DIFFERENTIAL_DECREASE,
      1 * DifferentialFlamegraph.ALPHA_SCALING,
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
    const after = makeFlamegraph({
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

    const flamegraph = DifferentialFlamegraph.FromDiff(
      {before, after},
      {negated: false},
      THEME
    );

    expect([...flamegraph.colors.values()][1]).toEqual([
      ...THEME.COLORS.DIFFERENTIAL_INCREASE,
      0.3 * DifferentialFlamegraph.ALPHA_SCALING, // (11 - 1) / 10
    ]);
    expect([...flamegraph.colors.values()][0]).toEqual([
      ...THEME.COLORS.DIFFERENTIAL_INCREASE,
      1 * DifferentialFlamegraph.ALPHA_SCALING, // (4 - 1) / 10
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
    const after = makeFlamegraph({
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

    const flamegraph = DifferentialFlamegraph.FromDiff(
      {before, after},
      {negated: false},
      THEME
    );

    expect([...flamegraph.colors.values()][0]).toEqual([
      ...THEME.COLORS.DIFFERENTIAL_DECREASE,
      1 * DifferentialFlamegraph.ALPHA_SCALING, // (11 - 1) / 10
    ]);
    expect([...flamegraph.colors.values()][1]).toEqual([
      ...THEME.COLORS.DIFFERENTIAL_DECREASE,
      0.2 * DifferentialFlamegraph.ALPHA_SCALING, // (4 - 1) / 10
    ]);
  });
});

describe('negation', () => {
  it('color encodes removed frames blue', () => {
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
    const after = makeFlamegraph({
      shared: {
        frames: [{name: 'function'}, {name: 'other function'}],
      },
      profiles: [
        {
          ...baseProfile,
          samples: [[0], [0]],
          weights: [1, 1],
        },
      ],
    });

    const flamegraph = DifferentialFlamegraph.FromDiff(
      {before, after},
      {negated: true},
      THEME
    );

    expect([...flamegraph.colors.values()][1]).toEqual([
      ...THEME.COLORS.DIFFERENTIAL_DECREASE,
      1 * DifferentialFlamegraph.ALPHA_SCALING,
    ]);
  });

  it('increase: color encodes functions that got slower as red', () => {
    const before = makeFlamegraph({
      shared: {
        frames: [{name: 'function'}],
      },
      profiles: [
        {
          ...baseProfile,
          samples: [[0], [0]],
          weights: [1, 1],
        },
      ],
    });
    const after = makeFlamegraph({
      shared: {
        frames: [{name: 'function'}],
      },
      profiles: [
        {
          ...baseProfile,
          samples: [[0], [0]],
          weights: [5, 5],
        },
      ],
    });

    const flamegraph = DifferentialFlamegraph.FromDiff(
      {before, after},
      {negated: true},
      THEME
    );

    expect([...flamegraph.colors.values()][0]).toEqual([
      ...THEME.COLORS.DIFFERENTIAL_INCREASE,
      1 * DifferentialFlamegraph.ALPHA_SCALING,
    ]);
  });

  it('decrease: color encodes functions that got faster as blue', () => {
    const before = makeFlamegraph({
      shared: {
        frames: [{name: 'function'}],
      },
      profiles: [
        {
          ...baseProfile,
          samples: [[0], [0]],
          weights: [10, 10],
        },
      ],
    });
    const after = makeFlamegraph({
      shared: {
        frames: [{name: 'function'}],
      },
      profiles: [
        {
          ...baseProfile,
          samples: [[0], [0]],
          weights: [1, 1],
        },
      ],
    });

    const flamegraph = DifferentialFlamegraph.FromDiff(
      {before, after},
      {negated: true},
      THEME
    );

    expect([...flamegraph.colors.values()][0]).toEqual([
      ...THEME.COLORS.DIFFERENTIAL_DECREASE,
      1 * DifferentialFlamegraph.ALPHA_SCALING,
    ]);
  });
});
