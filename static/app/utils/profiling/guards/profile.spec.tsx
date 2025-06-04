import {
  isEventedProfile,
  isJSProfile,
  isSampledProfile,
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
});
