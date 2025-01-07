import {ContinuousProfile} from 'sentry/utils/profiling/profile/continuousProfile';
import {createContinuousProfileFrameIndex} from 'sentry/utils/profiling/profile/utils';

import {makeSentryContinuousProfile, makeTestingBoilerplate} from './testUtils';

describe('ContinuousProfile', () => {
  it('imports the base properties', () => {
    const trace = makeSentryContinuousProfile({
      profile: {
        samples: [
          {timestamp: Date.now() / 1e3, stack_id: 0, thread_id: '0'},
          // 10ms later
          {timestamp: Date.now() / 1e3 + 0.01, stack_id: 1, thread_id: '0'},
        ],
        frames: [
          {function: 'foo', in_app: true},
          {function: 'bar', in_app: true},
        ],
        stacks: [
          [0, 1],
          [0, 1],
        ],
      },
    });

    const profile = ContinuousProfile.FromProfile(
      trace.profile,
      createContinuousProfileFrameIndex(trace.profile.frames, 'node')
    );

    expect(Math.round(profile.duration)).toBe(10);
    expect(profile.startedAt).toBe(1508208080 * 1e3);
    expect(profile.endedAt).toBe(1508208080.01 * 1e3);
  });

  it('rebuilds the stack', () => {
    const trace = makeSentryContinuousProfile({
      profile: {
        samples: [
          {timestamp: Date.now() / 1e3, stack_id: 0, thread_id: '0'},
          // 10ms later
          {timestamp: Date.now() / 1e3 + 0.01, stack_id: 1, thread_id: '0'},
        ],
        frames: [
          {function: 'foo', in_app: true, lineno: 0},
          {function: 'bar', in_app: true, lineno: 1},
        ],
        stacks: [
          [0, 1],
          [0, 1],
        ],
      },
    });

    const {open, close, timings} = makeTestingBoilerplate();

    const profile = ContinuousProfile.FromProfile(
      trace.profile,
      createContinuousProfileFrameIndex(trace.profile.frames, 'node')
    );

    profile.forEach(open, close);

    expect(timings).toEqual([
      ['bar', 'open'],
      ['foo', 'open'],
      ['foo', 'close'],
      ['bar', 'close'],
    ]);
  });
});
