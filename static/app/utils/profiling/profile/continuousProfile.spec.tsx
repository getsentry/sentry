import {ContinuousProfile} from 'sentry/utils/profiling/profile/continuousProfile';
import {
  eventedProfileToSampledProfile,
  importAndroidContinuousProfileChunk,
} from 'sentry/utils/profiling/profile/importProfile';
import {createContinuousProfileFrameIndex} from 'sentry/utils/profiling/profile/utils';

import {
  makeSentryAndroidContinuousProfileChunk,
  makeSentryContinuousProfile,
  makeTestingBoilerplate,
} from './testUtils';

describe('ContinuousProfile', () => {
  describe('sampled profile', () => {
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
        createContinuousProfileFrameIndex(trace.profile.frames, 'node'),
        {minTimestamp: 0, type: 'flamechart'}
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
        createContinuousProfileFrameIndex(trace.profile.frames, 'node'),
        {minTimestamp: 0, type: 'flamechart'}
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

  describe('android continuous profile chunk', () => {
    it('imports the base properties', () => {
      const trace = makeSentryAndroidContinuousProfileChunk({
        metadata: {
          timestamp: '2021-01-01T00:00:00.000Z',
        },
        shared: {
          frames: [
            {name: 'foo', line: 0},
            {name: 'bar', line: 1},
          ],
        },
        profiles: [
          {
            endValue: 100,
            events: [
              {type: 'O', frame: 0, at: 0},
              {type: 'O', frame: 1, at: 1},
              {type: 'C', frame: 1, at: 2},
              {type: 'C', frame: 0, at: 3},
            ],
            name: 'main',
            startValue: 0,
            threadID: 1,
            type: 'evented',
            unit: 'nanoseconds',
          },
        ],
      });

      const profile = importAndroidContinuousProfileChunk(trace, '123', {
        span: undefined,
        type: 'flamechart',
        frameFilter: undefined,
      });

      expect(profile.profiles[0]!.duration).toBe(0);
      expect(profile.profiles[0]!.startedAt).toBe(0);
      expect(profile.profiles[0]!.endedAt).toBe(0);
    });

    it('assigns stacks', () => {
      const trace = makeSentryAndroidContinuousProfileChunk({
        metadata: {
          timestamp: '2021-01-01T00:00:00.000Z',
        },
        shared: {
          frames: [
            {name: 'foo', line: 0},
            {name: 'bar', line: 1},
          ],
        },
        profiles: [
          {
            endValue: 100,
            events: [
              {type: 'O', frame: 0, at: 0},
              {type: 'O', frame: 1, at: 1},
              {type: 'C', frame: 1, at: 2},
              {type: 'C', frame: 0, at: 3},
            ],
            name: 'main',
            startValue: 0,
            threadID: 1,
            type: 'evented',
            unit: 'nanoseconds',
          },
        ],
      });

      const profile = eventedProfileToSampledProfile(0, trace.profiles);
      expect(profile.stacks).toEqual([[0], [1, 0], [0], []]);
      expect(profile.samples).toHaveLength(4);
      expect(profile.samples[0]!.stack_id).toBe(0);
      expect(profile.samples[1]!.stack_id).toBe(1);
      // We do not deduplicate stacks, so the third sample has a different stack_id
      expect(profile.samples[2]!.stack_id).toBe(2);
    });
  });
});
