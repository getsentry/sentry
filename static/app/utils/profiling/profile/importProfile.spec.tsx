import {ContinuousProfile} from 'sentry/utils/profiling/profile/continuousProfile';
import {EventedProfile} from 'sentry/utils/profiling/profile/eventedProfile';
import {
  importProfile,
  parseDroppedProfile,
} from 'sentry/utils/profiling/profile/importProfile';
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
        // @ts-expect-error
        {name: 'profile', activeProfileIndex: 0, profiles: [{type: 'unrecognized'}]},
        '',
        '',
        'flamechart'
      )
    ).toThrow();
  });
});

describe('parseDroppedProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('throws if file has no string contents', async () => {
    // @ts-expect-error we are just setting null on the file, we are not actually reading it because our event is mocked
    const file = new File([null], 'test.tsx');

    const reader = new FileReader();

    const fileReaderMock = jest
      .spyOn(window, 'FileReader')
      .mockImplementation(() => reader);
    const readAsTextMock = jest.spyOn(reader, 'readAsText').mockImplementation(() => {
      const loadEvent = new CustomEvent('load', {
        detail: {target: {result: null}},
      });

      reader.dispatchEvent(loadEvent);
    });

    await expect(parseDroppedProfile(file)).rejects.toBe(
      'Failed to read string contents of input file'
    );

    fileReaderMock.mockRestore();
    readAsTextMock.mockRestore();
  });

  it('throws if FileReader errors', async () => {
    const file = new File(['{json: true}'], 'test.tsx');

    const reader = new FileReader();

    const fileReaderMock = jest
      .spyOn(window, 'FileReader')
      .mockImplementation(() => reader);
    const readAsTextMock = jest.spyOn(reader, 'readAsText').mockImplementation(() => {
      const loadEvent = new CustomEvent('error', {
        detail: {target: {result: null}},
      });

      reader.dispatchEvent(loadEvent);
    });

    await expect(parseDroppedProfile(file)).rejects.toBe(
      'Failed to read string contents of input file'
    );

    fileReaderMock.mockRestore();
    readAsTextMock.mockRestore();
  });

  it('throws if contents are not valid JSON', async () => {
    const file = new File(['{"json": true'], 'test.tsx');
    await expect(parseDroppedProfile(file)).rejects.toBeInstanceOf(Error);
  });

  it('imports dropped schema file', async () => {
    const schema: Readonly<Profiling.Schema> = {
      activeProfileIndex: 0,
      profileID: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      profiles: [
        {
          name: 'profile',
          startValue: 0,
          endValue: 1000,
          threadID: 0,
          unit: 'milliseconds',
          type: 'sampled',
          weights: [],
          samples: [],
        },
      ],
      projectID: 1,
      shared: {
        frames: [],
      },
      metadata: {} as Profiling.Schema['metadata'],
    };
    const file = new File([JSON.stringify(schema)], 'test.tsx');
    const imported = importProfile(
      await parseDroppedProfile(file),
      file.name,
      '',
      'flamechart'
    );

    expect(imported.profiles[0]).toBeInstanceOf(SampledProfile);
  });

  it('imports dropped JS self profile', async () => {
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

    const file = new File([JSON.stringify(jsSelfProfile)], 'test.tsx');
    const imported = importProfile(
      await parseDroppedProfile(file),
      file.name,
      '',
      'flamechart'
    );

    expect(imported.profiles[0]).toBeInstanceOf(JSSelfProfile);
  });
});
