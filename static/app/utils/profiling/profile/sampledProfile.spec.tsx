import {SampledProfile} from 'sentry/utils/profiling/profile/sampledProfile';
import {createFrameIndex} from 'sentry/utils/profiling/profile/utils';

import {Frame} from '../frame';

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

    const profile = SampledProfile.FromProfile(trace, createFrameIndex('mobile', []), {
      type: 'flamechart',
    });

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
      createFrameIndex('mobile', [{name: 'f0'}]),
      {type: 'flamechart'}
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
      createFrameIndex('mobile', [{name: 'f0'}]),
      {type: 'flamechart'}
    );
    expect(profile.stats.negativeSamplesCount).toBe(1);
  });

  it('tracks raw weights', () => {
    const trace: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'sampled',
      weights: [0, 10, 20],
      samples: [[0], [0], []],
    };

    const profile = SampledProfile.FromProfile(
      trace,
      createFrameIndex('mobile', [{name: 'f0'}]),
      {type: 'flamechart'}
    );
    expect(profile.rawWeights.length).toBe(2);
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
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}]),
      {type: 'flamechart'}
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

    const root = firstCallee(profile.callTree);

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
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}]),
      {type: 'flamechart'}
    );

    expect(!!firstCallee(firstCallee(profile.callTree)).recursive).toBe(true);
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
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}]),
      {type: 'flamechart'}
    );

    expect(!!firstCallee(firstCallee(firstCallee(profile.callTree))).recursive).toBe(
      true
    );
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
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}, {name: 'f2'}]),
      {type: 'flamechart'}
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
      ]),
      {type: 'flamechart'}
    );

    // GC gets places on top of the previous stack and the weight is updated
    expect(profile.callTree.children[0].children[0].frame.name).toBe('f1 [native code]');
    // The total weight of the previous top is now the weight of the GC call + the weight of the previous top
    expect(profile.callTree.children[0].children[0].frame.totalWeight).toBe(4);
    expect(profile.callTree.children[0].children[0].children[0].frame.name).toBe(
      '(garbage collector) [native code]'
    );
    // The self weight of the GC call is only the weight of the GC call
    expect(profile.callTree.children[0].children[0].children[0].frame.selfWeight).toBe(3);
  });

  it('places garbage collector calls on top of previous stack and skips stack', () => {
    const trace: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'sampled',
      weights: [1, 1, 1, 1],
      samples: [
        [0, 1],
        [0, 2],
        [0, 2],
        [0, 1],
      ],
    };

    const profile = SampledProfile.FromProfile(
      trace,
      createFrameIndex('node', [
        {name: 'f0'},
        {name: 'f1'},
        {name: '(garbage collector)'},
      ]),
      {type: 'flamechart'}
    );

    expect(profile.weights).toEqual([1, 2, 1]);
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
      ]),
      {type: 'flamechart'}
    );

    expect(profile.callTree.children[0].children[0].children.length).toBe(2);
    expect(profile.callTree.children[0].children[0].children[0].frame.name).toBe(
      'f2 [native code]'
    );
    expect(profile.callTree.children[0].children[0].children[1].frame.name).toBe(
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
      ]),
      {type: 'flamechart'}
    );

    // There are no other children than the GC call meaning merge happened
    expect(profile.callTree.children[0].children[0].children[1]).toBe(undefined);
    expect(profile.callTree.children[0].children[0].children[0].frame.selfWeight).toBe(6);
  });

  it('flamegraph tracks node occurrences', () => {
    const trace: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'sampled',
      weights: [1, 1, 1],
      samples: [[0], [0, 1], [0]],
    };

    const profile = SampledProfile.FromProfile(
      trace,
      createFrameIndex('node', [{name: 'f0'}, {name: 'f1'}, {name: 'f2'}]),
      {type: 'flamechart'}
    );

    expect(profile.callTree.children[0].count).toBe(3);
    expect(profile.callTree.children[0].children[0].count).toBe(1);
  });

  it('filters frames', () => {
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

    const profile = SampledProfile.FromProfile(
      trace,
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}]),
      {
        type: 'flamegraph',
        frameFilter: frame => {
          return frame.name === 'f0';
        },
      }
    );

    expect(profile.callTree.frame).toBe(Frame.Root);
    expect(profile.callTree.children).toHaveLength(1);
    expect(profile.callTree.children[0].frame.name).toEqual('f0');
    // the f1 frame is filtered out, so the f0 frame has no children
    expect(profile.callTree.children[0].children).toHaveLength(0);
  });

  it('aggregates durations for flamegraph', () => {
    const trace: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'sampled',
      weights: [1, 1],
      sample_durations_ns: [10, 5],
      samples: [
        [0, 1],
        [0, 2],
      ],
    };

    const profile = SampledProfile.FromProfile(
      trace,
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}, {name: 'f2'}]),
      {
        type: 'flamegraph',
      }
    );

    expect(profile.callTree.children[0].frame.name).toBe('f0');
    expect(profile.callTree.children[0].aggregate_duration_ns).toBe(15);
    expect(profile.callTree.children[0].children[0].aggregate_duration_ns).toBe(10);
    expect(profile.callTree.children[0].children[1].aggregate_duration_ns).toBe(5);
    expect(profile.callTree.children[0].frame.aggregateDuration).toBe(15);
    expect(profile.callTree.children[0].children[0].frame.aggregateDuration).toBe(10);
    expect(profile.callTree.children[0].children[1].frame.aggregateDuration).toBe(5);
  });
});
