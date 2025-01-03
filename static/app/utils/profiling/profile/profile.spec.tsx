import {Frame} from 'sentry/utils/profiling/frame';
import {Profile} from 'sentry/utils/profiling/profile/profile';

import {c, f, makeTestingBoilerplate} from './testUtils';

describe('Profile', () => {
  it('Empty profile duration is not infinity', () => {
    const profile = Profile.Empty;
    expect(profile.duration).toEqual(1000);
    expect(profile.minFrameDuration).toEqual(1000);
  });

  it('forEach - iterates over a single sample', () => {
    const profile = new Profile({
      duration: 1000,
      startedAt: 0,
      endedAt: 1000,
      name: 'profile',
      unit: 'millisecond',
      threadId: 0,
      type: 'flamechart',
    });

    // Frames
    const f0 = f('f0', 0);
    const f1 = f('f1', 1);

    // Call tree nodes
    const s0 = c(f0);
    const s1 = c(f1);
    s0.parent = s1;

    profile.samples = [s0];

    const {open, close, openSpy, closeSpy, timings} = makeTestingBoilerplate();
    profile.forEach(open, close);

    expect(timings).toEqual([
      ['f1', 'open'],
      ['f0', 'open'],
      ['f0', 'close'],
      ['f1', 'close'],
    ]);

    expect(openSpy).toHaveBeenCalledTimes(2);
    expect(closeSpy).toHaveBeenCalledTimes(2);
  });

  it('forEach - opens new frames when stack is shared', () => {
    const profile = new Profile({
      duration: 1000,
      startedAt: 0,
      endedAt: 1000,
      name: 'profile',
      unit: 'millisecond',
      threadId: 0,
      type: 'flamechart',
    });

    // Frames
    const f0 = f('f0', 0);
    const f1 = f('f1', 1);
    const f2 = f('f2', 1);

    // Call tree nodes
    const s0 = c(f0);
    const s1 = c(f1);
    const s2 = c(f2);

    s1.parent = s0;
    s2.parent = s1;

    profile.samples = [s0, s1, s2];

    const {open, close, openSpy, closeSpy, timings} = makeTestingBoilerplate();
    profile.forEach(open, close);

    expect(timings).toEqual([
      ['f0', 'open'],
      ['f1', 'open'],
      ['f2', 'open'],
      ['f2', 'close'],
      ['f1', 'close'],
      ['f0', 'close'],
    ]);

    expect(openSpy).toHaveBeenCalledTimes(3);
    expect(closeSpy).toHaveBeenCalledTimes(3);
  });

  it('forEach - closes frames one by one when stack is shared', () => {
    const profile = new Profile({
      duration: 1000,
      startedAt: 0,
      endedAt: 1000,
      name: 'profile',
      unit: 'millisecond',
      threadId: 0,
      type: 'flamechart',
    });

    // Instantiate frames
    const f0 = f('f0', 0);
    const f1 = f('f1', 1);
    const f2 = f('f2', 2);

    // Instantiate call tree nodes
    const s0 = c(f2);
    const s1 = c(f1);
    const s2 = c(f0);

    profile.samples = [s0, s1, s2];

    const {open, close, openSpy, closeSpy, timings} = makeTestingBoilerplate();
    profile.forEach(open, close);

    expect(timings).toEqual([
      ['f2', 'open'],
      ['f2', 'close'],
      ['f1', 'open'],
      ['f1', 'close'],
      ['f0', 'open'],
      ['f0', 'close'],
    ]);

    expect(openSpy).toHaveBeenCalledTimes(3);
    expect(closeSpy).toHaveBeenCalledTimes(3);
  });

  // In JS land, the stack can be idle which is not the case in other runtimes, e.g. in mobile
  //  the program main is always running, so make sure we support "holes" in the samples
  it('forEach - supports an idle stack', () => {
    const profile = new Profile({
      duration: 1000,
      startedAt: 0,
      endedAt: 1000,
      name: 'profile',
      unit: 'millisecond',
      threadId: 0,
      type: 'flamechart',
    });

    // Instantiate frames
    const f0 = f('f0', 0);

    // Instantiate call tree nodes
    const s0 = c(f0);
    const s1 = c(Frame.Root);

    profile.samples = [s0, s1, s0];

    const {open, close, openSpy, closeSpy, timings} = makeTestingBoilerplate();
    profile.forEach(open, close);

    expect(timings).toEqual([
      ['f0', 'open'],
      ['f0', 'close'],
      ['f0', 'open'],
      ['f0', 'close'],
    ]);

    expect(openSpy).toHaveBeenCalledTimes(2);
    expect(closeSpy).toHaveBeenCalledTimes(2);
  });
});
