import {parseChromeTrace} from 'sentry/utils/profiling/profile/chromeTraceProfile';

describe('ChromeTraceProfile', () => {
  it('parses incomplete trace', () => {
    const trace: ChromeTrace.ArrayFormat = [
      {ts: 0, ph: 'B', cat: 'a', name: 'b', pid: 1, tid: 2, args: {}},
    ];

    const stringifiedTrace = JSON.stringify(trace);

    // Drop last character, parsing should attempt to inject it
    const partialTrace = trace.slice(0, stringifiedTrace.length - 1);

    expect(parseChromeTrace(partialTrace)).toEqual([
      {
        ts: 0,
        ph: 'B',
        cat: 'a',
        name: 'b',
        pid: 1,
        tid: 2,
        args: {},
      },
    ]);
  });
});
