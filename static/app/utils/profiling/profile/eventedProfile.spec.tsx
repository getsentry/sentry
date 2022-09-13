import {EventedProfile} from 'sentry/utils/profiling/profile/eventedProfile';
import {createFrameIndex} from 'sentry/utils/profiling/profile/utils';

import {firstCallee, makeTestingBoilerplate} from './profile.spec';

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

    const profile = EventedProfile.FromProfile(trace, createFrameIndex('mobile', []));

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
      createFrameIndex('mobile', [{name: 'f0'}])
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
      createFrameIndex('mobile', [{name: 'f0'}])
    );
    expect(profile.stats.negativeSamplesCount).toBe(1);
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

    const root = firstCallee(profile.appendOrderStack[0]);

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
      createFrameIndex('mobile', [{name: 'f0'}])
    );

    expect(firstCallee(firstCallee(profile.appendOrderTree)).isRecursive()).toBe(true);
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
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}])
    );

    expect(
      firstCallee(firstCallee(firstCallee(profile.appendOrderTree))).isRecursive()
    ).toBe(true);
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
      createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}, {name: 'f2'}])
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
        createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}, {name: 'f2'}])
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
        createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}, {name: 'f2'}])
      )
    ).toThrow('Unbalanced append order stack');
  });
});
