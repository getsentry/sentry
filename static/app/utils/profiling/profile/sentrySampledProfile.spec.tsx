import merge from 'lodash/merge';

import {DeepPartial} from 'sentry/types/utils';

import {makeTestingBoilerplate} from './profile.spec';
import {SentrySampledProfile} from './sentrySampledProfile';
import {createSentrySampleProfileFrameIndex} from './utils';

export const makeSentrySampledProfile = (
  profile?: DeepPartial<Profiling.SentrySampledProfile>
) => {
  return merge(
    {
      event_id: '1',
      version: '1',
      os: {
        name: 'iOS',
        version: '16.0',
        build_number: '19H253',
      },
      device: {
        architecture: 'arm64e',
        is_emulator: false,
        locale: 'en_US',
        manufacturer: 'Apple',
        model: 'iPhone14,3',
      },
      timestamp: '2022-09-01T09:45:00.000Z',
      release: '0.1 (199)',
      platform: 'cocoa',
      profile: {
        samples: [
          {
            stack_id: 0,
            thread_id: '0',
            elapsed_since_start_ns: '0',
          },
          {
            stack_id: 1,
            thread_id: '0',
            elapsed_since_start_ns: '1000',
          },
        ],
        frames: [
          {
            function: 'foo',
            instruction_addr: '',
            lineno: 2,
            colno: 2,
            file: 'main.c',
          },
          {
            function: 'main',
            instruction_addr: '',
            lineno: 1,
            colno: 1,
            file: 'main.c',
          },
        ],
        stacks: [[0], [0, 1]],
      },
    },
    profile
  ) as Profiling.SentrySampledProfile;
};

describe('SentrySampledProfile', () => {
  it('constructs a profile', () => {
    const sampledProfile: Profiling.SentrySampledProfile = makeSentrySampledProfile();

    const profile = SentrySampledProfile.FromProfile(
      sampledProfile,
      createSentrySampleProfileFrameIndex(sampledProfile.profile.frames)
    );

    const {open, close, timings} = makeTestingBoilerplate();
    profile.forEach(open, close);

    expect(profile.duration).toBe(1000);
    expect(timings).toEqual([
      ['main', 'open'],
      ['foo', 'open'],
      ['foo', 'close'],
      ['main', 'close'],
    ]);
    expect(profile.startedAt).toEqual(0);
    expect(profile.endedAt).toEqual(1000);
  });

  it('derives a profile name from the transaction.name and thread_id', () => {
    const sampledProfile = makeSentrySampledProfile({
      transactions: [
        {
          id: '',
          name: 'foo',
          active_thread_id: '1',
          relative_start_ns: '0',
          relative_end_ns: '1000000',
          trace_id: '1',
        },
      ],
      profile: {
        samples: [
          {
            stack_id: 0,
            elapsed_since_start_ns: '1000',
            thread_id: '0',
          },
        ],
        thread_metadata: {
          '0': {
            name: 'bar',
          },
        },
      },
    });

    const profile = SentrySampledProfile.FromProfile(
      sampledProfile,
      createSentrySampleProfileFrameIndex(sampledProfile.profile.frames)
    );

    expect(profile.name).toBe('foo (thread: bar)');
  });

  it('derives a profile name from just thread_id', () => {
    const sampledProfile = makeSentrySampledProfile({
      profile: {
        samples: [
          {
            stack_id: 0,
            elapsed_since_start_ns: '1000',
            thread_id: '0',
          },
        ],
        thread_metadata: {},
      },
    });

    const profile = SentrySampledProfile.FromProfile(
      sampledProfile,
      createSentrySampleProfileFrameIndex(sampledProfile.profile.frames)
    );

    expect(profile.name).toBe('thread: 0');
  });

  it('derives a profile name from just thread name', () => {
    const sampledProfile = makeSentrySampledProfile({
      profile: {
        samples: [
          {
            stack_id: 0,
            elapsed_since_start_ns: '1000',
            thread_id: '0',
          },
        ],
        thread_metadata: {
          '0': {
            name: 'foo',
          },
        },
      },
    });

    const profile = SentrySampledProfile.FromProfile(
      sampledProfile,
      createSentrySampleProfileFrameIndex(sampledProfile.profile.frames)
    );

    expect(profile.name).toBe('thread: foo');
  });

  it('throws a TypeError when it cannot parse startedAt or endedAt', () => {
    const sampledProfile = makeSentrySampledProfile({
      profile: {
        samples: [
          {
            stack_id: 0,
            elapsed_since_start_ns: 'a1000',
            thread_id: '0',
          },
        ],
        thread_metadata: {
          '0': {
            name: 'foo',
          },
        },
      },
    });

    expect(() =>
      SentrySampledProfile.FromProfile(
        sampledProfile,
        createSentrySampleProfileFrameIndex(sampledProfile.profile.frames)
      )
    ).toThrow(new TypeError('startedAt or endedAt is NaN'));
  });
});
