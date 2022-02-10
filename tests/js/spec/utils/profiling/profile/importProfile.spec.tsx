import {EventedProfile} from 'sentry/utils/profiling/profile/eventedProfile';
import {
  importDroppedProfile,
  importProfile,
} from 'sentry/utils/profiling/profile/importProfile';
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
    };

    const imported = importProfile(
      {
        name: 'profile',
        activeProfileIndex: 0,
        profiles: [eventedProfile],
        shared: {
          frames: [],
        },
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
    };

    const imported = importProfile(
      {
        name: 'profile',
        activeProfileIndex: 0,
        profiles: [sampledProfile],
        shared: {
          frames: [],
        },
      },
      ''
    );

    expect(imported.profiles[0]).toBeInstanceOf(SampledProfile);
  });
  it('imports JS self profile', () => {
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
        shared: {
          frames: [],
        },
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

describe.only('importDroppedProfile', () => {
  it('throws if FileReader fails to read file', () => {
    const file = new File(['null'], 'test.tsx');
    const reader = new FileReader();

    jest.spyOn
    jest.spyOn(window, 'FileReader').mockImplementation(() => reader);

    jest.spyOn(reader, 'readAsText').mockImplementation(() => {

    expect(
      async () => await importDroppedProfile(file).catch(e => console.log(e))
    ).toThrow('test');
  });
});
