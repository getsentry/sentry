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
  endValue: 0,
  startValue: 100,
};

const eventedProfile: Profiling.EventedProfile = {
  type: 'evented',
  events: [],
  name: 'profile',
  unit: 'milliseconds',
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
  describe('sampled profile', () => {
    it('is sampled', () => expect(isSampledProfile(sampledProfile)).toBe(true));
    it('is not sampled', () => expect(isSampledProfile(eventedProfile)).toBe(false));
  });
  describe('evented profile', () => {
    it('is evented', () => expect(isEventedProfile(eventedProfile)).toBe(true));
    it('is not evented', () => expect(isEventedProfile(sampledProfile)).toBe(false));
  });
  describe('js profile', () => {
    it('is js', () => expect(isJSProfile(jsProfile)).toBe(true));
    it('is not js', () => expect(isJSProfile(eventedProfile)).toBe(false));
  });
});
