import {ContinuousProfile} from 'sentry/utils/profiling/profile/continuousProfile';
import {createContinuousProfileFrameIndex} from 'sentry/utils/profiling/profile/utils';

import {makeTestingBoilerplate} from './profile.spec';

describe('ContinuousProfile', () => {
  it('imports the base properties', () => {
    const trace: Profiling.SentryContinousProfileChunk = {
      chunk_id: 'chunk_id',
      environment: '',
      project_id: 0,
      received: 0,
      release: '',
      organization_id: 0,
      retention_days: 0,
      version: '2',
      platform: 'node',
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
    };

    const profile = ContinuousProfile.FromChunk(
      trace,
      createContinuousProfileFrameIndex(trace.profile.frames, 'node')
    );

    expect(Math.round(profile.duration)).toBe(10);
    expect(profile.startedAt).toBe(1508208080);
    expect(profile.endedAt).toBe(1508208080.01);
  });

  it('rebuilds the stack', () => {
    const trace: Profiling.SentryContinousProfileChunk = {
      chunk_id: 'chunk_id',
      environment: '',
      project_id: 0,
      received: 0,
      release: '',
      organization_id: 0,
      retention_days: 0,
      version: '2',
      platform: 'node',
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
    };

    const {open, close, timings} = makeTestingBoilerplate();

    const profile = ContinuousProfile.FromChunk(
      trace,
      createContinuousProfileFrameIndex(trace.profile.frames, 'node')
    );

    profile.forEach(open, close);

    expect(timings).toEqual([
      ['foo', 'open'],
      ['bar', 'open'],
      ['bar', 'close'],
      ['foo', 'close'],
    ]);
  });
});
