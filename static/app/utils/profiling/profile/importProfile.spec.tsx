import {ContinuousProfile} from 'sentry/utils/profiling/profile/continuousProfile';
import {EventedProfile} from 'sentry/utils/profiling/profile/eventedProfile';
import {importProfile} from 'sentry/utils/profiling/profile/importProfile';
import {JSSelfProfile} from 'sentry/utils/profiling/profile/jsSelfProfile';
import {SampledProfile} from 'sentry/utils/profiling/profile/sampledProfile';

import {SentrySampledProfile} from './sentrySampledProfile';
import {makeSentryContinuousProfile, makeSentrySampledProfile} from './testUtils';

describe('importProfile', () => {
  it('imports evented profile', () => {
    const eventedProfile: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      threadID: 0,
      unit: 'milliseconds',
      type: 'evented',
      events: [],
    };

    const imported = importProfile(
      {
        activeProfileIndex: 0,
        profileID: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        profiles: [eventedProfile],
        projectID: 1,
        shared: {
          frames: [],
        },
        metadata: {} as Profiling.Schema['metadata'],
      },
      '',
      '',
      'flamechart'
    );

    expect(imported.profiles[0]).toBeInstanceOf(EventedProfile);
  });
  it('imports sampled profile', () => {
    const sampledProfile: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      threadID: 0,
      unit: 'milliseconds',
      type: 'sampled',
      weights: [],
      samples: [],
    };

    const imported = importProfile(
      {
        activeProfileIndex: 0,
        profileID: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        profiles: [sampledProfile],
        projectID: 1,
        shared: {
          frames: [],
        },
        metadata: {} as Profiling.Schema['metadata'],
      },
      '',
      '',
      'flamechart'
    );

    expect(imported.profiles[0]).toBeInstanceOf(SampledProfile);
  });
  it('imports JS self profile from schema', () => {
    const jsSelfProfile: JSSelfProfiling.Trace = {
      resources: ['app.js', 'vendor.js'],
      frames: [{name: 'ReactDOM.render', line: 1, column: 1, resourceId: 0}],
      samples: [
        {
          timestamp: 0,
          stackId: 0,
        },
        {
          timestamp: 1000,
          stackId: 0,
        },
      ],
      stacks: [
        {
          frameId: 0,
        },
      ],
    };

    const imported = importProfile(
      {
        activeProfileIndex: 0,
        profileID: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        profiles: [jsSelfProfile],
        projectID: 1,
        metadata: {} as Profiling.Schema['metadata'],
        shared: {
          frames: [],
        },
      },
      '',
      '',
      'flamechart'
    );

    expect(imported.profiles[0]).toBeInstanceOf(JSSelfProfile);
  });

  it('imports JS self profile from raw Profiling output', () => {
    const jsSelfProfile: JSSelfProfiling.Trace = {
      resources: ['app.js', 'vendor.js'],
      frames: [{name: 'ReactDOM.render', line: 1, column: 1, resourceId: 0}],
      samples: [
        {
          timestamp: 0,
          stackId: 0,
        },
        {
          timestamp: 1000,
          stackId: 0,
        },
      ],
      stacks: [
        {
          frameId: 0,
        },
      ],
    };

    const imported = importProfile(jsSelfProfile, 'profile', '', 'flamechart');

    expect(imported.profiles[0]).toBeInstanceOf(JSSelfProfile);
  });

  it('imports sentry sampled profile', () => {
    const sentrySampledProfile = makeSentrySampledProfile();

    const imported = importProfile(sentrySampledProfile, 'profile', '', 'flamegraph');

    expect(imported.profiles[0]).toBeInstanceOf(SentrySampledProfile);
  });

  it('imports sentry continuous profile', () => {
    const continuousProfile = makeSentryContinuousProfile();

    const imported = importProfile(continuousProfile, 'profile', '', 'flamegraph');

    expect(imported.profiles[0]).toBeInstanceOf(ContinuousProfile);
  });

  it('throws on unrecognized profile type', () => {
    expect(() =>
      importProfile(
        // @ts-expect-error wrong type 'unrecognized' is on purpose
        {name: 'profile', activeProfileIndex: 0, profiles: [{type: 'unrecognized'}]},
        '',
        '',
        'flamechart'
      )
    ).toThrow();
  });
});
