import {makeTestingBoilerplate} from './profile.spec';
import {SentrySampledProfile} from './sentrySampledProfile';
import {createSentrySampleProfileFrameIndex} from './utils';

describe('SentrySampledProfile', () => {
  it('constructs a profile', () => {
    const samples: Profiling.SentrySampledProfile['profile'] = {
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
          name: 'main',
          instruction_addr: '',
          line: 1,
          file: 'main.c',
        },
        {
          name: 'foo',
          instruction_addr: '',
          line: 2,
          file: 'main.c',
        },
      ],
      stacks: [[0], [0, 1]],
      thread_metadata: {},
      queue_metadata: {},
    };

    const profile = SentrySampledProfile.FromProfile(
      samples.samples,
      samples.stacks,
      createSentrySampleProfileFrameIndex(samples.frames)
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
});
