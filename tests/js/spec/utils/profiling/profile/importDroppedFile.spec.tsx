import {importDroppedFile} from 'sentry/utils/profiling/profile/importDroppedFile';

describe('importDroppedFile', () => {
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

    await expect(importDroppedFile(file)).rejects.toEqual(
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

    await expect(importDroppedFile(file)).rejects.toEqual(
      'Failed to read string contents of input file'
    );
  });

  it('throws if contents are not valid JSON', async () => {
    const file = new File(['{"json": true'], 'test.tsx');
    await expect(importDroppedFile(file)).rejects.toBeInstanceOf(Error);
  });

  it('imports schema file', async () => {
    const schema: Profiling.Schema = {
      name: 'profile',
      activeProfileIndex: 0,
      profiles: [
        {
          name: 'profile',
          startValue: 0,
          endValue: 1000,
          unit: 'milliseconds',
          type: 'sampled',
          weights: [],
          samples: [],
        },
      ],
      shared: {
        frames: [],
      },
    };
    const file = new File([JSON.stringify(schema)], 'test.tsx');
    const imported = (await importDroppedFile(file)) as ProfileGroup;

    expect(imported.profiles[0]).toBeInstanceOf(SampledProfile);
  });

  it('imports JS self profile', async () => {
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

    const file = new File([JSON.stringify(jsSelfProfile)], 'test.tsx');
    const imported = (await importDroppedFile(file)) as ProfileGroup;

    expect(imported.profiles[0]).toBeInstanceOf(JSSelfProfile);
  });
});
