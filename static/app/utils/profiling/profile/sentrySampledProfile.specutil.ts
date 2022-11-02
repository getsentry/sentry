import merge from 'lodash/merge';

import {DeepPartial} from 'sentry/types/utils';

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
