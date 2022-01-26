import {EventedProfile} from 'sentry/utils/profiling/profile/eventedProfile';
import {importProfile} from 'sentry/utils/profiling/profile/importProfile';
import {JSSelfProfile} from 'sentry/utils/profiling/profile/jsSelfProfile';
import {SampledProfile} from 'sentry/utils/profiling/profile/sampledProfile';

describe('importProfile', () => {
  it('imports evented profile', () => {
    const eventedProfile: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      type: 'evented',
      events: [],
      shared: {
        frames: [],
      },
    };

    const imported = importProfile(
      {
        name: 'profile',
        activeProfileIndex: 0,
        profiles: [eventedProfile],
      },
      ''
    );

    expect(imported.profiles[0]).toBeInstanceOf(EventedProfile);
  });
  it('imports sampled profile', () => {
    const sampledProfile: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      type: 'sampled',
      weights: [],
      samples: [],
      shared: {
        frames: [],
      },
    };

    const imported = importProfile(
      {
        name: 'profile',
        activeProfileIndex: 0,
        profiles: [sampledProfile],
      },
      ''
    );

    expect(imported.profiles[0]).toBeInstanceOf(SampledProfile);
  });
  it('imports js self profile', () => {
    const jsSelfProfile: JSSelfProfiling.Trace = {
      resources: ['app.js', 'vendor.js'],
      frames: [{name: 'ReactDOM.render', line: 1, column: 1, resourceId: 0}],
      samples: [
        {
          timestamp: 0,
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
        name: 'profile',
        activeProfileIndex: 0,
        profiles: [jsSelfProfile],
      },
      ''
    );

    expect(imported.profiles[0]).toBeInstanceOf(JSSelfProfile);
  });
  it('throws on unrecognized profile type', () => {
    expect(() =>
      importProfile(
        // @ts-ignore
        {name: 'profile', activeProfileIndex: 0, profiles: [{type: 'unrecognized'}]},
        ''
      )
    ).toThrow();
  });
});
