import {EventedProfile} from 'sentry/utils/profiling/profile/eventedProfile';
import {createFrameIndex} from 'sentry/utils/profiling/profile/utils';

import {Frame} from '../frame';

import {firstCallee, makeTestingBoilerplate} from './testUtils';

describe('EventedProfile', () => {
  it('imports the base properties', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [],
    };

    const profile = EventedProfile.FromProfile(trace, createFrameIndex('mobile', []), {
      type: 'flamechart',
    });

    expect(profile.duration).toBe(1000);
    expect(profile.name).toBe(trace.name);
    expect(profile.threadId).toBe(trace.threadID);
    expect(profile.startedAt).toBe(0);
    expect(profile.endedAt).toBe(1000);
  });

  it('tracks discarded samples', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'C', at: 0, frame: 0},
      ],
    };

    const profile = EventedProfile.FromProfile(
      trace,
      createFrameIndex('mobile', [{name: 'f0'}]),
      {type: 'flamechart'}
    );

    expect(profile.stats.discardedSamplesCount).toBe(1);
  });

  it('tracks negative samples', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'C', at: -1, frame: 0},
      ],
    };

    const profile = EventedProfile.FromProfile(
      trace,
      createFrameIndex('mobile', [{name: 'f0'}]),
      {type: 'flamechart'}
    );
    expect(profile.stats.negativeSamplesCount).toBe(1);
  });

  it('tracks raw weights', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'C', at: 10, frame: 0},
        {type: 'O', at: 15, frame: 0},
        {type: 'C', at: 20, frame: 0},
      ],
    };

    const profile = EventedProfile.FromProfile(
      trace,
      createFrameIndex('mobile', [{name: 'f0'}]),
      {type: 'flamechart'}
    );

    expect(profile.rawWeights.length).toBe(2);
  });

  it('rebuilds the stack', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 1, frame: 1},
        {type: 'C', at: 2, frame: 1},
        {type: 'C', at: 4, frame: 0},
      ],
    };

    const {open, close, openSpy, closeSpy, timings} = makeTestingBoilerplate();

    const profile = EventedProfile.FromProfile(
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

    expect(root.totalWeight).toEqual(4);
    expect(firstCallee(root).totalWeight).toEqual(1);

    expect(root.selfWeight).toEqual(3);
    expect(firstCallee(root).selfWeight).toEqual(1);
  });

  it('marks direct recursion', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 1, frame: 0},
        {type: 'C', at: 1, frame: 0},
        {type: 'C', at: 1, frame: 0},
      ],
    };

    const profile = EventedProfile.FromProfile(
      trace,
      createFrameIndex('mobile', [{name: 'f0'}]),
      {type: 'flamechart'}
    );

    expect(!!firstCallee(firstCallee(profile.callTree)).recursive).toBe(true);
  });

  it('marks indirect recursion', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 1, frame: 1},
        {type: 'O', at: 2, frame: 0},
        {type: 'C', at: 3, frame: 0},
        {type: 'C', at: 2, frame: 1},
        {type: 'C', at: 2, frame: 0},
      ],
    };

    const profile = EventedProfile.FromProfile(
      trace,
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}]),
      {type: 'flamechart'}
    );

    expect(!!firstCallee(firstCallee(firstCallee(profile.callTree))).recursive).toBe(
      true
    );
  });

  it('tracks minFrameDuration', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 5, frame: 1},
        {type: 'C', at: 5.5, frame: 1},
        {type: 'C', at: 10, frame: 0},
      ],
    };

    const profile = EventedProfile.FromProfile(
      trace,
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}, {name: 'f2'}]),
      {type: 'flamechart'}
    );

    expect(profile.minFrameDuration).toBe(0.5);
  });

  it('throws if samples are our of order', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 5, frame: 0},
        {type: 'O', at: 2, frame: 1},
        {type: 'C', at: 5.5, frame: 1},
        {type: 'C', at: 5.5, frame: 1},
        // Simulate unclosed frame
      ],
    };

    expect(() =>
      EventedProfile.FromProfile(
        trace,
        createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}, {name: 'f2'}]),
        {type: 'flamechart'}
      )
    ).toThrow('Sample delta cannot be negative, samples may be corrupt or out of order');
  });

  it('throws on unbalanced stack', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 5, frame: 1},
        {type: 'C', at: 5.5, frame: 1},
        // Simulate unclosed frame
      ],
    };

    expect(() =>
      EventedProfile.FromProfile(
        trace,
        createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}, {name: 'f2'}]),
        {type: 'flamechart'}
      )
    ).toThrow('Unbalanced append order stack');
  });
});

describe('EventedProfile - flamegraph', () => {
  it('merges consecutive stacks', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'C', at: 1, frame: 0},
        {type: 'O', at: 1, frame: 0},
        {type: 'C', at: 2, frame: 0},
      ],
    };

    const profile = EventedProfile.FromProfile(
      trace,
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}, {name: 'f2'}]),
      {type: 'flamegraph'}
    );

    expect(profile.callTree.children.length).toBe(1);
    expect(profile.callTree.children[0].selfWeight).toBe(2);
    expect(profile.callTree.totalWeight).toBe(2);
  });

  it('creates a graph', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'C', at: 1, frame: 0},
        {type: 'O', at: 1, frame: 1},
        {type: 'C', at: 2, frame: 1},
        {type: 'O', at: 2, frame: 0},
        {type: 'C', at: 3, frame: 0},
      ],
    };

    const profile = EventedProfile.FromProfile(
      trace,
      createFrameIndex('mobile', [
        {name: 'f0'},
        {name: 'f1'},
        {name: 'f2'},
        {name: 'f3'},
      ]),
      {type: 'flamegraph'}
    );

    expect(profile.callTree.children[0].frame.name).toBe('f0');
    expect(profile.callTree.children[1].frame.name).toBe('f1');

    // frame 0 is opened twice, so the weight gets merged
    expect(profile.samples.length).toBe(2);
    expect(profile.weights[0]).toBe(2);
    expect(profile.weights[1]).toBe(1);
    expect(profile.weights.length).toBe(2);
  });

  it('flamegraph tracks node count', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 10, frame: 1},
        {type: 'C', at: 20, frame: 1},
        {type: 'C', at: 30, frame: 0},
      ],
    };

    const profile = EventedProfile.FromProfile(
      trace,
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}]),
      {type: 'flamegraph'}
    );

    // frame 0 is opened twice, so the weight gets merged
    expect(profile.callTree.children[0].count).toBe(3);
    expect(profile.callTree.children[0].children[0].count).toBe(1);
  });

  it('filters frames', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 10, frame: 1},
        {type: 'C', at: 20, frame: 1},
        {type: 'C', at: 30, frame: 0},
      ],
    };

    const profile = EventedProfile.FromProfile(
      trace,
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}]),
      {
        type: 'flamegraph',
        frameFilter: frame => frame.name === 'f0',
      }
    );

    expect(profile.callTree.frame).toBe(Frame.Root);
    expect(profile.callTree.children).toHaveLength(1);
    expect(profile.callTree.children[0].frame.name).toEqual('f0');
    // the f1 frame is filtered out, so the f0 frame has no children
    expect(profile.callTree.children[0].children).toHaveLength(0);
  });
});
