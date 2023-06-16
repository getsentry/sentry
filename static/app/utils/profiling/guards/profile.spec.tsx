import {
  isEventedProfile,
  isJSProfile,
  isSampledProfile,
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

describe('profile', () => {
  it('is sampled', () => expect(isSampledProfile(sampledProfile)).toBe(true));
  it('is evented', () => expect(isEventedProfile(eventedProfile)).toBe(true));
  it('is js self profile', () => expect(isJSProfile(jsProfile)).toBe(true));
});
