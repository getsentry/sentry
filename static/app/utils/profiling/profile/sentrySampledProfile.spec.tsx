import {Frame} from '../frame';

import {SentrySampledProfile} from './sentrySampledProfile';
import {makeSentrySampledProfile, makeTestingBoilerplate} from './testUtils';
import {createSentrySampleProfileFrameIndex} from './utils';

describe('SentrySampledProfile', () => {
  it('constructs a profile', () => {
    const sampledProfile: Profiling.SentrySampledProfile = makeSentrySampledProfile();

    const profile = SentrySampledProfile.FromProfile(
      sampledProfile,
      createSentrySampleProfileFrameIndex(sampledProfile.profile.frames, 'javascript'),
      {type: 'flamechart'}
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

  it('tracks discarded samples', () => {
    const sampledProfile = makeSentrySampledProfile({
      transaction: {
        id: '',
        name: 'foo',
        active_thread_id: 1,
        trace_id: '1',
      },
      profile: {
        samples: [
          {
            stack_id: 0,
            elapsed_since_start_ns: 1000,
            thread_id: '0',
          },
          {
            stack_id: 0,
            elapsed_since_start_ns: 1000,
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
      createSentrySampleProfileFrameIndex(sampledProfile.profile.frames, 'javascript'),
      {type: 'flamechart'}
    );

    expect(profile.stats.discardedSamplesCount).toBe(2);
  });

  it('tracks negative samples', () => {
    const sampledProfile = makeSentrySampledProfile({
      transaction: {
        id: '',
        name: 'foo',
        active_thread_id: 1,
        trace_id: '1',
      },
      profile: {
        samples: [
          {
            stack_id: 0,
            elapsed_since_start_ns: 1000,
            thread_id: '0',
          },
          {
            stack_id: 0,
            elapsed_since_start_ns: -1000,
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
      createSentrySampleProfileFrameIndex(sampledProfile.profile.frames, 'javascript'),
      {type: 'flamechart'}
    );

    expect(profile.stats.negativeSamplesCount).toBe(1);
  });

  it('tracks raw weights', () => {
    const sampledProfile = makeSentrySampledProfile({
      transaction: {
        id: '',
        name: 'foo',
        active_thread_id: 1,
        trace_id: '1',
      },
      profile: {
        samples: [
          {
            stack_id: 0,
            elapsed_since_start_ns: 1000,
            thread_id: '0',
          },
          {
            stack_id: 0,
            elapsed_since_start_ns: 2000,
            thread_id: '0',
          },
          {
            stack_id: 0,
            elapsed_since_start_ns: 3000,
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
      createSentrySampleProfileFrameIndex(sampledProfile.profile.frames, 'javascript'),
      {type: 'flamechart'}
    );

    expect(profile.rawWeights.length).toBe(2);
  });

  it('derives a profile name from the transaction.name and thread_id', () => {
    const sampledProfile = makeSentrySampledProfile({
      transaction: {
        id: '',
        name: 'foo',
        active_thread_id: 1,
        trace_id: '1',
      },
      profile: {
        samples: [
          {
            stack_id: 0,
            elapsed_since_start_ns: 1000,
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
      createSentrySampleProfileFrameIndex(sampledProfile.profile.frames, 'javascript'),
      {type: 'flamechart'}
    );

    expect(profile.name).toBe('bar');
    expect(profile.threadId).toBe(0);
  });

  it('derives a profile name from just thread_id', () => {
    const sampledProfile = makeSentrySampledProfile({
      platform: 'python',
      profile: {
        samples: [
          {
            stack_id: 0,
            elapsed_since_start_ns: 1000,
            thread_id: '0',
          },
        ],
        thread_metadata: {},
      },
    });

    const profile = SentrySampledProfile.FromProfile(
      sampledProfile,
      createSentrySampleProfileFrameIndex(sampledProfile.profile.frames, 'javascript'),
      {type: 'flamechart'}
    );

    expect(profile.name).toBe('');
    expect(profile.threadId).toBe(0);
  });

  it('derives a profile name from just thread name', () => {
    const sampledProfile = makeSentrySampledProfile({
      profile: {
        samples: [
          {
            stack_id: 0,
            elapsed_since_start_ns: 1000,
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
      createSentrySampleProfileFrameIndex(sampledProfile.profile.frames, 'javascript'),
      {type: 'flamechart'}
    );

    expect(profile.name).toBe('foo');
    expect(profile.threadId).toBe(0);
  });

  it('derives a coca profile name from active thread id', () => {
    const sampledProfile = makeSentrySampledProfile({
      profile: {
        samples: [
          {
            stack_id: 0,
            elapsed_since_start_ns: 1000,
            thread_id: '0',
          },
        ],
        thread_metadata: {},
      },
    });

    const profile = SentrySampledProfile.FromProfile(
      sampledProfile,
      createSentrySampleProfileFrameIndex(sampledProfile.profile.frames, 'javascript'),
      {type: 'flamechart'}
    );

    expect(profile.name).toBe('com.apple.main-thread');
    expect(profile.threadId).toBe(0);
  });

  it('derives a coca profile name from queue label', () => {
    const sampledProfile = makeSentrySampledProfile({
      profile: {
        samples: [
          {
            stack_id: 0,
            elapsed_since_start_ns: 1000,
            thread_id: '1',
            queue_address: '0x000000016bec7180',
          },
        ],
        thread_metadata: {},
        queue_metadata: {
          '0x000000016bec7180': {label: 'sentry-http-transport'},
        },
      },
    });

    const profile = SentrySampledProfile.FromProfile(
      sampledProfile,
      createSentrySampleProfileFrameIndex(sampledProfile.profile.frames, 'javascript'),
      {type: 'flamechart'}
    );

    expect(profile.name).toBe('sentry-http-transport');
    expect(profile.threadId).toBe(1);
  });

  it('derives a coca profile name from queue label thats main thread', () => {
    const sampledProfile = makeSentrySampledProfile({
      transaction: {
        id: '',
        name: 'foo',
        active_thread_id: 1,
        trace_id: '1',
      },
      profile: {
        samples: [
          {
            stack_id: 0,
            elapsed_since_start_ns: 1000,
            thread_id: '1',
            queue_address: '0x000000016bec7180',
          },
        ],
        thread_metadata: {},
        queue_metadata: {
          '0x000000016bec7180': {label: 'com.apple.main-thread'},
        },
      },
    });

    const profile = SentrySampledProfile.FromProfile(
      sampledProfile,
      createSentrySampleProfileFrameIndex(sampledProfile.profile.frames, 'javascript'),
      {type: 'flamechart'}
    );

    expect(profile.name).toBe('com.apple.main-thread');
    expect(profile.threadId).toBe(1);
  });

  it('derives a coca profile name from queue label thats not main thread', () => {
    const sampledProfile = makeSentrySampledProfile({
      transaction: {
        id: '',
        name: 'foo',
        active_thread_id: 0,
        trace_id: '1',
      },
      profile: {
        samples: [
          {
            stack_id: 0,
            elapsed_since_start_ns: 1000,
            thread_id: '1',
            queue_address: '0x000000016bec7180',
          },
        ],
        thread_metadata: {},
        queue_metadata: {
          '0x000000016bec7180': {label: 'com.apple.main-thread'},
        },
      },
    });

    const profile = SentrySampledProfile.FromProfile(
      sampledProfile,
      createSentrySampleProfileFrameIndex(sampledProfile.profile.frames, 'javascript'),
      {type: 'flamechart'}
    );

    expect(profile.name).toBe('');
    expect(profile.threadId).toBe(1);
  });

  it('flamegraph tracks node occurrences', () => {
    const sampledProfile = makeSentrySampledProfile({
      transaction: {
        id: '',
        name: 'foo',
        active_thread_id: 1,
        trace_id: '1',
      },
      profile: {
        samples: [
          {
            stack_id: 0,
            elapsed_since_start_ns: 1000,
            thread_id: '0',
          },
          {
            stack_id: 1,
            elapsed_since_start_ns: 2000,
            thread_id: '0',
          },
          {
            stack_id: 0,
            elapsed_since_start_ns: 3000,
            thread_id: '0',
          },
        ],
        thread_metadata: {
          '0': {
            name: 'bar',
          },
        },
        // Frame 0 occurs 3 times, frame 1 occurs once
        stacks: [[0], [1, 0], [0]],
        frames: [{function: 'f0'}, {function: 'f1'}, {function: 'f2'}],
      },
    });

    const profile = SentrySampledProfile.FromProfile(
      sampledProfile,
      createSentrySampleProfileFrameIndex(sampledProfile.profile.frames, 'javascript'),
      {type: 'flamegraph'}
    );

    expect(profile.callTree.children[0]!.count).toBe(2);
    expect(profile.callTree.children[0]!.children[0]!.count).toBe(1);
  });

  it('filters frames', () => {
    const sampledProfile = makeSentrySampledProfile({
      transaction: {
        id: '',
        name: 'foo',
        active_thread_id: 1,
        trace_id: '1',
      },
      profile: {
        samples: [
          {
            stack_id: 0,
            elapsed_since_start_ns: 1000,
            thread_id: '0',
          },
          {
            stack_id: 0,
            elapsed_since_start_ns: 2000,
            thread_id: '0',
          },
        ],
        thread_metadata: {
          '0': {
            name: 'bar',
          },
        },
        stacks: [[1, 0]],
        frames: [{function: 'f0'}, {function: 'f1'}],
      },
    });

    const profile = SentrySampledProfile.FromProfile(
      sampledProfile,
      createSentrySampleProfileFrameIndex(sampledProfile.profile.frames, 'javascript'),
      {
        type: 'flamegraph',
        frameFilter: frame => frame.name === 'f0',
      }
    );

    expect(profile.callTree.frame).toBe(Frame.Root);
    expect(profile.callTree.children).toHaveLength(1);
    expect(profile.callTree.children[0]!.frame.name).toEqual('f0');
    // the f1 frame is filtered out, so the f0 frame has no children
    expect(profile.callTree.children[0]!.children).toHaveLength(0);
  });
});
