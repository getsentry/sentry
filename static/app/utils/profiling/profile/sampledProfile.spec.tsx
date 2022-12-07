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

  it('places garbage collector calls on top of previous stack for node', () => {
    const trace: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'sampled',
      weights: [1, 3],
      samples: [
        [0, 1],
        [0, 2],
      ],
    };

    const profile = SampledProfile.FromProfile(
      trace,
      createFrameIndex('node', [
        {name: 'f0'},
        {name: 'f1'},
        {name: '(garbage collector)'},
      ])
    );

    // GC gets places on top of the previous stack and the weight is updated
    expect(profile.appendOrderTree.children[0].children[0].frame.name).toBe(
      'f1 [native code]'
    );
    // The total weight of the previous top is now the weight of the GC call + the weight of the previous top
    expect(profile.appendOrderTree.children[0].children[0].frame.totalWeight).toBe(4);
    expect(profile.appendOrderTree.children[0].children[0].children[0].frame.name).toBe(
      '(garbage collector) [native code]'
    );
    // The self weight of the GC call is only the weight of the GC call
    expect(
      profile.appendOrderTree.children[0].children[0].children[0].frame.selfWeight
    ).toBe(3);
  });

  it('does not place garbage collector calls on top of previous stack for node', () => {
    const trace: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'sampled',
      weights: [1, 2],
      samples: [
        [0, 1, 3],
        [0, 1, 2],
      ],
    };

    const profile = SampledProfile.FromProfile(
      trace,
      createFrameIndex('node', [
        {name: 'f0'},
        {name: 'f1'},
        {name: '(garbage collector)'},
        {name: 'f2'},
      ])
    );

    expect(profile.appendOrderTree.children[0].children[0].children.length).toBe(2);
    expect(profile.appendOrderTree.children[0].children[0].children[0].frame.name).toBe(
      'f2 [native code]'
    );
    expect(profile.appendOrderTree.children[0].children[0].children[1].frame.name).toBe(
      '(garbage collector) [native code]'
    );
  });

  it('merges consecutive garbage collector calls on top of previous stack for node', () => {
    const trace: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'sampled',
      weights: [1, 2, 2, 2],
      samples: [
        [0, 1],
        [0, 2],
        [0, 2],
        [0, 2],
      ],
    };

    const profile = SampledProfile.FromProfile(
      trace,
      createFrameIndex('node', [
        {name: 'f0'},
        {name: 'f1'},
        {name: '(garbage collector)'},
      ])
    );

    // There are no other children than the GC call meaning merge happened
    expect(profile.appendOrderTree.children[0].children[0].children[1]).toBe(undefined);
    expect(
      profile.appendOrderTree.children[0].children[0].children[0].frame.selfWeight
    ).toBe(6);
  });
});
