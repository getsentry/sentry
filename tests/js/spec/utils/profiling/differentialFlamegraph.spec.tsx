import {DifferentialFlamegraph} from 'sentry/utils/profiling/differentialFlamegraph';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {EventedProfile} from 'sentry/utils/profiling/profile/eventedProfile';
import {createFrameIndex} from 'sentry/utils/profiling/profile/utils';

const makeEvent = (times: number, frame: number): Profiling.Event[] => {
  return new Array(times * 2).fill(0).map((_, i) => {
    return {type: i % 2 === 0 ? 'O' : 'C', at: i, frame};
  });
};

const baseProfile: Profiling.EventedProfile = {
  name: 'profile',
  startValue: 0,
  endValue: 1000,
  unit: 'milliseconds',
  type: 'evented',
  events: [],
};
const makeFlamegraph = (profile: Profiling.EventedProfile) => {
  return new Flamegraph(
    EventedProfile.FromProfile(
      profile,
      createFrameIndex([{name: 'f0'}, {name: 'f1'}, {name: 'f2'}, {name: 'f3'}])
    ),
    0,
    {
      inverted: false,
      leftHeavy: false,
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
  it('INCREASE: color encodes new frames red', () => {
    const from = makeFlamegraph({
      ...baseProfile,
      events: [],
    });
    const to = makeFlamegraph({
      ...baseProfile,
      events: [...makeEvent(1, 0)],
    });

    const flamegraph = DifferentialFlamegraph.Diff(from, to, THEME);
    expect(flamegraph.colors?.get('f0')).toEqual([1, 0, 0, 1]);
  });
  it('INCREASE: color encodes relative increase in red', () => {
    const from = makeFlamegraph({
      ...baseProfile,
      events: [...makeEvent(2, 0)],
    });
    const to = makeFlamegraph({
      ...baseProfile,
      events: [...makeEvent(3, 0)],
    });

    const flamegraph = DifferentialFlamegraph.Diff(from, to, THEME);
    expect(flamegraph.colors?.get('f0')).toEqual([1, 0, 0, 0.5]);
  });
  it('DECREASE: color encodes relative decrease in blue', () => {
    const from = makeFlamegraph({
      ...baseProfile,
      events: [...makeEvent(4, 0)],
    });
    const to = makeFlamegraph({
      ...baseProfile,
      events: [...makeEvent(2, 0)],
    });

    const flamegraph = DifferentialFlamegraph.Diff(from, to, THEME);
    expect(flamegraph.colors?.get('f0')).toEqual([0, 0, 1, 0.5]);
  });
  it('No change: no color is set', () => {
    const from = makeFlamegraph({
      ...baseProfile,
      events: [...makeEvent(2, 0)],
    });
    const to = makeFlamegraph({
      ...baseProfile,
      events: [...makeEvent(2, 0)],
    });

    const flamegraph = DifferentialFlamegraph.Diff(from, to, THEME);
    expect(flamegraph.colors?.get('f0')).toBe(undefined);
  });
});
