import {
  isChromeTraceArrayFormat,
  isEventedProfile,
  isJSProfile,
  isSampledProfile,
  isTypescriptChromeTraceArrayFormat,
} from 'sentry/utils/profiling/guards/profile';

const sampledProfile: Profiling.SampledProfile = {
  type: 'sampled',
  weights: [],
  samples: [],
  name: 'profile',
  unit: 'milliseconds',
  threadID: 0,
  endValue: 0,
  startValue: 100,
};

const eventedProfile: Profiling.EventedProfile = {
  type: 'evented',
  events: [],
  name: 'profile',
  unit: 'milliseconds',
  threadID: 0,
  endValue: 0,
  startValue: 100,
};

const jsProfile: JSSelfProfiling.Trace = {
  resources: [],
  frames: [],
  stacks: [],
  samples: [],
};

const typescriptTraceProfile: ChromeTrace.ArrayFormat = [
  {
    args: {},
    cat: '',
    name: 'thread_name',
    ph: 'B',
    pid: 579,
    tid: 259,
    ts: 0,
  },
  {
    args: {},
    cat: '',
    name: 'thread_name',
    ph: 'E',
    pid: 579,
    tid: 259,
    ts: 0,
  },
];

const chrometraceArrayFormat: ChromeTrace.ArrayFormat = [
  {cat: '', ph: 'P', name: 'ProfileChunk', args: {}, pid: 579, tid: 259, ts: 0},
];

describe('profile', () => {
  it('is sampled', () => expect(isSampledProfile(sampledProfile)).toBe(true));
  it('is evented', () => expect(isEventedProfile(eventedProfile)).toBe(true));
  it('is js self profile', () => expect(isJSProfile(jsProfile)).toBe(true));
  it('is ts profile', () => {
    // Since these are the same format, just different contents, we test both to make
    // sure that one does not pass through the other.
    expect(isTypescriptChromeTraceArrayFormat(typescriptTraceProfile)).toBe(true);
    expect(isTypescriptChromeTraceArrayFormat(chrometraceArrayFormat)).toBe(false);
  });
  it('is chrometrace format', () => {
    // Since these are the same format, just different contents, we test both to make
    // sure that one does not pass through the other.
    expect(isChromeTraceArrayFormat(chrometraceArrayFormat)).toBe(true);
    expect(isChromeTraceArrayFormat(typescriptTraceProfile)).toBe(false);
  });
});
