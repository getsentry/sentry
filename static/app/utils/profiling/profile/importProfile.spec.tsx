import {ChromeTraceProfile} from 'sentry/utils/profiling/profile/chromeTraceProfile';
import {EventedProfile} from 'sentry/utils/profiling/profile/eventedProfile';
import {
  importProfile,
  parseDroppedProfile,
} from 'sentry/utils/profiling/profile/importProfile';
import {JSSelfProfile} from 'sentry/utils/profiling/profile/jsSelfProfile';
import {SampledProfile} from 'sentry/utils/profiling/profile/sampledProfile';

import {SentrySampledProfile} from './sentrySampledProfile';
import {makeSentrySampledProfile} from './sentrySampledProfile.spec';

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
      'flamechart'
    );

    expect(imported.profiles[0]).toBeInstanceOf(SampledProfile);
  });

  it('imports typescript profile', () => {
    const typescriptProfile: ChromeTrace.ArrayFormat = [
      {
        ph: 'B',
        ts: 1000,
        cat: 'program',
        pid: 0,
        tid: 0,
        name: 'createProgram',
        args: {configFilePath: '/Users/jonasbadalic/Work/sentry/tsconfig.json'},
      },
      {
        ph: 'E',
        ts: 2000,
        cat: 'program',
        pid: 0,
        tid: 0,
        name: 'createProgram',
        args: {configFilePath: '/Users/jonasbadalic/Work/sentry/tsconfig.json'},
      },
    ];

    const imported = importProfile(typescriptProfile, '', 'flamechart');
    expect(imported.profiles[0]).toBeInstanceOf(ChromeTraceProfile);
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

    const imported = importProfile(jsSelfProfile, 'profile', 'flamechart');

    expect(imported.profiles[0]).toBeInstanceOf(JSSelfProfile);
  });

  it('imports sentry sampled profile', () => {
    const sentrySampledProfile = makeSentrySampledProfile();

    const imported = importProfile(sentrySampledProfile, 'profile', 'flamegraph');

    expect(imported.profiles[0]).toBeInstanceOf(SentrySampledProfile);
  });

  it('throws on unrecognized profile type', () => {
    expect(() =>
      importProfile(
        // @ts-ignore
        {name: 'profile', activeProfileIndex: 0, profiles: [{type: 'unrecognized'}]},
        '',
        'flamechart'
      )
    ).toThrow();
  });
});

describe('parseDroppedProfile', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });
  it('throws if file has no string contents', async () => {
    // @ts-ignore we are just setting null on the file, we are not actually reading it because our event is mocked
    const file = new File([null], 'test.tsx');

    const reader = new FileReader();

    jest.spyOn(window, 'FileReader').mockImplementation(() => reader);
    jest.spyOn(reader, 'readAsText').mockImplementation(() => {
      const loadEvent = new CustomEvent('load', {
        detail: {target: {result: null}},
      });

      reader.dispatchEvent(loadEvent);
    });

    await expect(parseDroppedProfile(file)).rejects.toEqual(
      'Failed to read string contents of input file'
    );
  });

  it('throws if FileReader errors', async () => {
    const file = new File(['{json: true}'], 'test.tsx');

    const reader = new FileReader();

    jest.spyOn(window, 'FileReader').mockImplementation(() => reader);
    jest.spyOn(reader, 'readAsText').mockImplementation(() => {
      const loadEvent = new CustomEvent('error', {
        detail: {target: {result: null}},
      });

      reader.dispatchEvent(loadEvent);
    });

    await expect(parseDroppedProfile(file)).rejects.toEqual(
      'Failed to read string contents of input file'
    );
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
      'flamechart'
    );

    expect(imported.profiles[0]).toBeInstanceOf(SampledProfile);
  });

  it('imports dropped typescript profile', async () => {
    const typescriptProfile: ChromeTrace.ArrayFormat = [
      {
        ph: 'B',
        ts: 1000,
        cat: 'program',
        pid: 0,
        tid: 0,
        name: 'createProgram',
        args: {configFilePath: '/Users/jonasbadalic/Work/sentry/tsconfig.json'},
      },
      {
        ph: 'E',
        ts: 2000,
        cat: 'program',
        pid: 0,
        tid: 0,
        name: 'createProgram',
        args: {configFilePath: '/Users/jonasbadalic/Work/sentry/tsconfig.json'},
      },
    ];

    const file = new File([JSON.stringify(typescriptProfile)], 'test.tsx');
    const imported = importProfile(
      await parseDroppedProfile(file),
      file.name,
      'flamechart'
    );

    expect(imported.profiles[0]).toBeInstanceOf(ChromeTraceProfile);
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
      'flamechart'
    );

    expect(imported.profiles[0]).toBeInstanceOf(JSSelfProfile);
  });
});
