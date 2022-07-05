import {
  ChromeTraceProfile,
  collapseSamples,
  parseChromeTraceArrayFormat,
  splitEventsByProcessAndTraceId,
} from 'sentry/utils/profiling/profile/chromeTraceProfile';

describe('splitEventsByProcessAndTraceId', () => {
  it('splits by thread id', () => {
    const trace: ChromeTrace.ArrayFormat = [
      {
        ph: 'B',
        tid: 0,
        pid: 0,
        cat: '',
        name: '',
        ts: 0,
        args: [],
      },
      {
        ph: 'B',
        tid: 1,
        pid: 0,
        cat: '',
        name: '',
        ts: 0,
        args: [],
      },
    ];

    expect(splitEventsByProcessAndTraceId(trace).get(0)?.get(0)).toEqual([trace[0]]);
    expect(splitEventsByProcessAndTraceId(trace).get(0)?.get(1)).toEqual([trace[1]]);
  });
});

describe('parseChromeTraceArrayFormat', () => {
  it('returns chrometrace profile', () => {
    expect(
      parseChromeTraceArrayFormat(
        [
          {
            ph: 'M',
            ts: 0,
            cat: '',
            pid: 0,
            tid: 0,
            name: 'process_name',
            args: {name: 'Process Name'},
          },
          {
            ph: 'B',
            ts: 0,
            cat: 'program',
            pid: 0,
            tid: 0,
            name: 'createProgram',
            args: {configFilePath: '/Users/jonasbadalic/Work/sentry/tsconfig.json'},
          },
        ],
        ''
      ).profiles[0]
    ).toBeInstanceOf(ChromeTraceProfile);
  });

  it('marks process name', () => {
    expect(
      parseChromeTraceArrayFormat(
        [
          {
            ph: 'M',
            ts: 0,
            cat: '',
            pid: 0,
            tid: 0,
            name: 'process_name',
            args: {name: 'Process Name'},
          },
          {
            ph: 'B',
            ts: 0,
            cat: 'program',
            pid: 0,
            tid: 0,
            name: 'createProgram',
            args: {configFilePath: '/Users/jonasbadalic/Work/sentry/tsconfig.json'},
          },
        ],
        ''
      ).profiles[0].name
    ).toBe('Process Name (0): tid (0)');
  });

  it('marks thread name', () => {
    expect(
      parseChromeTraceArrayFormat(
        [
          {
            ph: 'M',
            ts: 0,
            cat: '',
            pid: 0,
            tid: 0,
            name: 'thread_name',
            args: {name: 'Thread Name'},
          },
          {
            ph: 'B',
            ts: 0,
            cat: 'program',
            pid: 0,
            tid: 0,
            name: 'createProgram',
            args: {configFilePath: '/Users/jonasbadalic/Work/sentry/tsconfig.json'},
          },
        ],
        ''
      ).profiles[0].name
    ).toBe('pid (0): Thread Name (0)');
  });

  it('imports a simple trace', () => {
    const trace = parseChromeTraceArrayFormat(
      [
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
      ],
      ''
    );

    expect(trace.profiles[0].startedAt).toBe(1000);
    expect(trace.profiles[0].endedAt).toBe(2000);
    expect(trace.profiles[0].duration).toBe(1000);
    expect(trace.profiles[0].appendOrderTree.children[0].totalWeight).toBe(1000);
  });

  it('closes unclosed events', () => {
    const trace = parseChromeTraceArrayFormat(
      [
        {
          ph: 'B',
          ts: 0,
          cat: 'program',
          pid: 0,
          tid: 0,
          name: 'createProgram',
          args: {frame: '0'},
        },
        {
          ph: 'B',
          ts: 1000,
          cat: 'program',
          pid: 0,
          tid: 0,
          name: 'createProgram',
          args: {frame: '1'},
        },
        {
          ph: 'E',
          ts: 2000,
          cat: 'program',
          pid: 0,
          tid: 0,
          name: 'createProgram',
          args: {frame: '1'},
        },
      ],
      ''
    );

    expect(trace.profiles[0].duration).toBe(2000);
    expect(trace.profiles[0].appendOrderTree.children[0].selfWeight).toBe(1000);
    expect(trace.profiles[0].appendOrderTree.children[0].totalWeight).toBe(2000);
    expect(trace.profiles[0].appendOrderTree.children[0].children[0].selfWeight).toBe(
      1000
    );
  });

  it('handles out of order E events', () => {
    const trace = parseChromeTraceArrayFormat(
      [
        {
          ph: 'B',
          ts: 0,
          cat: '',
          pid: 0,
          tid: 0,
          name: '',
          args: {frame: '0'},
        },
        {
          ph: 'B',
          ts: 1,
          cat: '',
          pid: 0,
          tid: 0,
          name: '',
          args: {frame: '1'},
        },
        {
          ph: 'E',
          ts: 2,
          cat: '',
          pid: 0,
          tid: 0,
          name: '',
          args: {frame: '0'},
        },
        {
          ph: 'E',
          ts: 2,
          cat: '',
          pid: 0,
          tid: 0,
          name: '',
          args: {frame: '1'},
        },
      ],
      ''
    );

    expect(trace.profiles[0].duration).toBe(2);
    expect(trace.profiles[0].appendOrderTree.children[0].selfWeight).toBe(1);
    expect(trace.profiles[0].appendOrderTree.children[0].totalWeight).toBe(2);
    expect(trace.profiles[0].appendOrderTree.children[0].frame.name).toBe(
      'Unknown {"frame":"0"}'
    );
    expect(trace.profiles[0].appendOrderTree.children[0].children[0].frame.name).toBe(
      'Unknown {"frame":"1"}'
    );
    expect(trace.profiles[0].appendOrderTree.children[0].children[0].selfWeight).toBe(1);
    expect(trace.profiles[0].appendOrderTree.children[0].children[0].totalWeight).toBe(1);
  });

  it('handles out of order B events', () => {
    const trace = parseChromeTraceArrayFormat(
      [
        {
          ph: 'B',
          ts: 0,
          cat: '',
          pid: 0,
          tid: 0,
          name: '',
          args: {frame: '0'},
        },
        {
          ph: 'B',
          ts: 1,
          cat: '',
          pid: 0,
          tid: 0,
          name: '',
          args: {frame: '1'},
        },
        {
          ph: 'E',
          ts: 2,
          cat: '',
          pid: 0,
          tid: 0,
          name: '',
          args: {frame: '0'},
        },
        {
          ph: 'E',
          ts: 2,
          cat: '',
          pid: 0,
          tid: 0,
          name: '',
          args: {frame: '1'},
        },
      ],
      ''
    );

    expect(trace.profiles[0].duration).toBe(2);
    expect(trace.profiles[0].appendOrderTree.children[0].selfWeight).toBe(1);
    expect(trace.profiles[0].appendOrderTree.children[0].totalWeight).toBe(2);
    expect(trace.profiles[0].appendOrderTree.children[0].frame.name).toBe(
      'Unknown {"frame":"0"}'
    );
    expect(trace.profiles[0].appendOrderTree.children[0].children[0].frame.name).toBe(
      'Unknown {"frame":"1"}'
    );
    expect(trace.profiles[0].appendOrderTree.children[0].children[0].selfWeight).toBe(1);
    expect(trace.profiles[0].appendOrderTree.children[0].children[0].totalWeight).toBe(1);
  });

  it('handles X trace with tdur', () => {
    const trace = parseChromeTraceArrayFormat(
      [
        {
          ph: 'X',
          ts: 0,
          cat: '',
          pid: 0,
          tid: 0,
          tdur: 100,
          name: '',
          args: {frame: '0'},
        },
      ],
      ''
    );

    expect(trace.profiles[0].duration).toBe(100);
  });

  it('handles X trace with dur', () => {
    const trace = parseChromeTraceArrayFormat(
      [
        {
          ph: 'X',
          ts: 0,
          cat: '',
          pid: 0,
          tid: 0,
          dur: 100,
          name: '',
          args: {frame: '0'},
        },
      ],
      ''
    );

    expect(trace.profiles[0].duration).toBe(100);
  });
});

describe('collapseSamples', () => {
  it.each([
    {
      samples: [1, 1],
      timeDeltas: [0, 1],
      expectedSamples: [1, 1],
      expectedTimeDeltas: [0, 1],
    },
    {
      samples: [1, 1, 1],
      timeDeltas: [0, 1, 1],
      expectedSamples: [1, 1],
      expectedTimeDeltas: [0, 2],
    },
    {
      samples: [1, 2, 1],
      timeDeltas: [0, 1, 2],
      expectedSamples: [1, 2, 1],
      expectedTimeDeltas: [0, 1, 3],
    },
    {
      samples: [1, 2, 3, 4],
      timeDeltas: [0, 1, 1, 1],
      expectedSamples: [1, 2, 3, 4],
      expectedTimeDeltas: [0, 1, 2, 3],
    },
  ])('collapses sample', test => {
    const result = collapseSamples({
      startTime: 0,
      endTime: 100,
      samples: test.samples,
      timeDeltas: test.timeDeltas,
      nodes: [],
    });

    expect(result.samples).toEqual(test.expectedSamples);
    expect(result.sampleTimes).toEqual(test.expectedTimeDeltas);
  });

  it('guards from negative samples', () => {
    const result = collapseSamples({
      startTime: 0,
      endTime: 100,
      samples: [1, 2, 3],
      timeDeltas: [1, -1, 1],
      nodes: [],
    });

    expect(result.samples).toEqual([1, 2, 3]);
    expect(result.sampleTimes).toEqual([1, 1, 2]);
  });

  it('guards from negative samples when they are being collapsed', () => {
    const result = collapseSamples({
      startTime: 0,
      endTime: 100,
      samples: [1, 1, 1],
      timeDeltas: [1, -1, 2],
      nodes: [],
    });

    expect(result.samples).toEqual([1, 1]);
    expect(result.sampleTimes).toEqual([1, 3]);
  });
});
