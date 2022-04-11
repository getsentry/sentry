import {
  ChromeTraceProfile,
  importChromeTraceArrayFormat,
  splitEventsByProcessAndTraceId,
  TypeScriptProfile,
} from 'sentry/utils/profiling/profile/formats/chromeTraceProfile';

const BASE_EVENT: ChromeTrace.Event = {
  pid: 0,
  tid: 0,
  ph: 'B',
  cat: '',
  name: '',
  ts: 0,
  args: [],
};

describe('splitEventsByProcessAndTraceId', () => {
  it('splits by process id', () => {
    const trace: ChromeTrace.ArrayFormat = [
      {
        ...BASE_EVENT,
        pid: 0,
        tid: 0,
      },
      {
        ...BASE_EVENT,
        pid: 1,
        tid: 0,
      },
    ];

    expect(splitEventsByProcessAndTraceId(trace)[0][0]).toEqual([trace[0]]);
    expect(splitEventsByProcessAndTraceId(trace)[1][0]).toEqual([trace[1]]);
  });
  it('splits by thread id', () => {
    const trace: ChromeTrace.ArrayFormat = [
      {
        pid: 0,
        tid: 0,
        ph: 'B',
        cat: '',
        name: '',
        ts: 0,
        args: [],
      },
      {
        pid: 0,
        tid: 1,
        ph: 'B',
        cat: '',
        name: '',
        ts: 0,
        args: [],
      },
    ];

    expect(splitEventsByProcessAndTraceId(trace)[0][0]).toEqual([trace[0]]);
    expect(splitEventsByProcessAndTraceId(trace)[0][1]).toEqual([trace[1]]);
  });
});

describe('importChromeTrace', () => {
  it('returns chrometrace profile', () => {
    expect(
      importChromeTraceArrayFormat(
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
      importChromeTraceArrayFormat(
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
      importChromeTraceArrayFormat(
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
    const trace = importChromeTraceArrayFormat(
      [
        {
          ph: 'B',
          ts: 0,
          cat: 'program',
          pid: 0,
          tid: 0,
          name: 'createProgram',
          args: {configFilePath: '/Users/jonasbadalic/Work/sentry/tsconfig.json'},
        },
        {
          ph: 'E',
          ts: 1000,
          cat: 'program',
          pid: 0,
          tid: 0,
          name: 'createProgram',
          args: {configFilePath: '/Users/jonasbadalic/Work/sentry/tsconfig.json'},
        },
      ],
      ''
    );

    expect(trace.profiles[0].duration).toBe(1000);
    expect(trace.profiles[0].appendOrderTree.children[0].totalWeight).toBe(1000);
  });

  it('closes unclosed events', () => {
    const trace = importChromeTraceArrayFormat(
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
    const trace = importChromeTraceArrayFormat(
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
    expect(trace.profiles[0].appendOrderTree.children[0].frame.name).toBe('Unknown');
    expect(trace.profiles[0].appendOrderTree.children[0].children[0].frame.name).toBe(
      'Unknown'
    );
    expect(trace.profiles[0].appendOrderTree.children[0].children[0].selfWeight).toBe(1);
    expect(trace.profiles[0].appendOrderTree.children[0].children[0].totalWeight).toBe(1);
  });

  it('handles out of order B events', () => {
    const trace = importChromeTraceArrayFormat(
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
    expect(trace.profiles[0].appendOrderTree.children[0].frame.name).toBe('Unknown');
    expect(trace.profiles[0].appendOrderTree.children[0].children[0].frame.name).toBe(
      'Unknown'
    );
    expect(trace.profiles[0].appendOrderTree.children[0].children[0].selfWeight).toBe(1);
    expect(trace.profiles[0].appendOrderTree.children[0].children[0].totalWeight).toBe(1);
  });

  it('handles X trace with tdur', () => {
    const trace = importChromeTraceArrayFormat(
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
    const trace = importChromeTraceArrayFormat(
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

  it('marks trace as typescript trace if first frame.cat is createProgram', () => {
    expect(
      importChromeTraceArrayFormat(
        [
          {
            name: 'process_name',
            args: {name: 'tsc'},
            cat: '__metadata',
            ph: 'M',
            ts: 86978.20799797773,
            pid: 1,
            tid: 1,
          },
          {
            name: 'TracingStartedInBrowser',
            cat: 'disabled-by-default-devtools.timeline',
            ph: 'M',
            ts: 86978.20799797773,
            pid: 1,
            tid: 1,
          },
          {
            pid: 1,
            tid: 1,
            ph: 'B',
            cat: 'program',
            ts: 87415.45800119638,
            name: 'createProgram',
            args: {},
          },
          {
            ph: 'X',
            ts: 900000,
            cat: '',
            pid: 1,
            tid: 1,
            dur: 100,
            name: '',
            args: {frame: '0'},
          },
        ],
        ''
      ).profiles[0]
    ).toBeInstanceOf(TypeScriptProfile);
  });
});
