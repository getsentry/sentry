import {
  isEventedProfile,
  isJSProfile,
  isSampledProfile,
  isSentryAndroidContinuousProfileChunk,
  isSentryContinuousProfileChunk,
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

const sentryContinuousProfileChunk: Profiling.SentryContinousProfileChunk = {
  chunk_id: '',
  environment: '',
  project_id: 0,
  received: 0,
  release: '',
  organization_id: 0,
  retention_days: 0,
  version: '2',
  platform: '',
  profile: {
    samples: [],
    frames: [],
    stacks: [],
  },
};

describe('profile', () => {
  it('is sampled', () => expect(isSampledProfile(sampledProfile)).toBe(true));
  it('is evented', () => expect(isEventedProfile(eventedProfile)).toBe(true));
  it('is js self profile', () => expect(isJSProfile(jsProfile)).toBe(true));
  it('is continuous profile chunk', () =>
    expect(isSentryContinuousProfileChunk(sentryContinuousProfileChunk)).toBe(true));

  describe('isSentryAndroidContinuousProfileChunk', () => {
    it('matches the explicit android trace version', () =>
      expect(
        isSentryAndroidContinuousProfileChunk({
          platform: 'android',
          version: '2.android-trace',
        })
      ).toBe(true));

    it('matches an android chunk with a missing version', () =>
      expect(
        isSentryAndroidContinuousProfileChunk({
          platform: 'android',
          profile: {methods: []},
        })
      ).toBe(true));

    it('matches an android chunk that stores frames in methods', () =>
      expect(
        isSentryAndroidContinuousProfileChunk({
          platform: 'android',
          version: '2',
          profile: {methods: []},
        })
      ).toBe(true));

    it('does not match a version="2" sampled android chunk', () =>
      expect(
        isSentryAndroidContinuousProfileChunk({
          ...sentryContinuousProfileChunk,
          platform: 'android',
        })
      ).toBe(false));
  });
});
