import {SampledProfile} from 'sentry/utils/profiling/profile/sampledProfile';
import {createFrameIndex} from 'sentry/utils/profiling/profile/utils';

import {firstCallee, makeTestingBoilerplate} from './profile.spec';

describe('SampledProfile', () => {
  it('imports the base properties', () => {
    const trace: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'sampled',
      weights: [],
      samples: [],
    };

    const profile = SampledProfile.FromProfile(trace, createFrameIndex('mobile', []));

    expect(profile.duration).toBe(1000);
    expect(profile.name).toBe(trace.name);
    expect(profile.threadId).toBe(trace.threadID);
    expect(profile.startedAt).toBe(0);
    expect(profile.endedAt).toBe(1000);
  });

  it('tracks discarded samples', () => {
    const trace: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'sampled',
      weights: [0],
      samples: [[0]],
    };

    const profile = SampledProfile.FromProfile(
      trace,
      createFrameIndex('mobile', [{name: 'f0'}])
    );
    expect(profile.stats.discardedSamplesCount).toBe(1);
  });

  it('tracks negative samples', () => {
    const trace: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'sampled',
      weights: [0, -1],
      samples: [[0], [0]],
    };

    const profile = SampledProfile.FromProfile(
      trace,
      createFrameIndex('mobile', [{name: 'f0'}])
    );
    expect(profile.stats.negativeSamplesCount).toBe(1);
  });

  it('rebuilds the stack', () => {
    const trace: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'sampled',
      weights: [1, 1],
      samples: [
        [0, 1],
        [0, 1],
      ],
    };

    const {open, close, openSpy, closeSpy, timings} = makeTestingBoilerplate();

    const profile = SampledProfile.FromProfile(
      trace,
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}])
    );

    profile.forEach(open, close);

    expect(timings).toEqual([
      ['f0', 'open'],
      ['f1', 'open'],
      ['f1', 'close'],
      ['f0', 'close'],
    ]);
    expect(openSpy).toHaveBeenCalledTimes(2);
    expect(closeSpy).toHaveBeenCalledTimes(2);

    const root = firstCallee(profile.appendOrderTree);

    expect(root.totalWeight).toEqual(2);
    expect(firstCallee(root).totalWeight).toEqual(2);

    expect(root.selfWeight).toEqual(0);
    expect(firstCallee(root).selfWeight).toEqual(2);
  });

  it('marks direct recursion', () => {
    const trace: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'sampled',
      weights: [1],
      samples: [[0, 0]],
    };

    const profile = SampledProfile.FromProfile(
      trace,
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}])
    );

    expect(firstCallee(firstCallee(profile.appendOrderTree)).isRecursive()).toBe(true);
  });

  it('marks indirect recursion', () => {
    const trace: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'sampled',
      weights: [1],
      samples: [[0, 1, 0]],
    };

    const profile = SampledProfile.FromProfile(
      trace,
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}])
    );

    expect(
      // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
      firstCallee(firstCallee(firstCallee(profile.appendOrderTree))).isRecursive()
    ).toBe(true);
  });

  it('tracks minFrameDuration', () => {
    const trace: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'sampled',
      weights: [0.5, 2],
      samples: [
        [0, 1],
        [0, 2],
      ],
    };

    const profile = SampledProfile.FromProfile(
      trace,
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}, {name: 'f2'}])
    );

    expect(profile.minFrameDuration).toBe(0.5);
  });
});
