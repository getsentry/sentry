import {ChromeTraceProfile} from 'sentry/utils/profiling/profile/formats/chromeTraceProfile';
import {EventedProfile} from 'sentry/utils/profiling/profile/formats/eventedProfile';
import {JSSelfProfile} from 'sentry/utils/profiling/profile/formats/jsSelfProfile';
import {SampledProfile} from 'sentry/utils/profiling/profile/formats/sampledProfile';
import {importProfile} from 'sentry/utils/profiling/profile/importProfile';

const eventedProfile: Profiling.EventedProfile = {
  name: 'profile',
  startValue: 0,
  endValue: 1000,
  unit: 'milliseconds',
  type: 'evented',
  events: [],
};

const sampledProfile: Profiling.SampledProfile = {
  name: 'profile',
  startValue: 0,
  endValue: 1000,
  unit: 'milliseconds',
  type: 'sampled',
  weights: [],
  samples: [],
};

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

const chromeTraceProfile: ChromeTrace.ArrayFormat = [
  {cat: 'program', ph: 'B', ts: 0, pid: 0, tid: 0, name: 'frame'},
  {cat: 'program', ph: 'E', ts: 1, pid: 0, tid: 0, name: 'frame'},
];

describe('importProfile', () => {
  it.each([
    ['evented', eventedProfile, EventedProfile],
    ['sampled', sampledProfile, SampledProfile],
    ['js self profile', jsSelfProfile, JSSelfProfile],
  ])('it imports as %s', (_, profile, constructor) => {
    expect(
      importProfile(
        {
          name: 'profile',
          activeProfileIndex: 0,
          profiles: [profile],
          shared: {frames: []},
        },
        ''
      ).profiles[0]
    ).toBeInstanceOf(constructor);
  });
  it('imports chrometrace', () => {
    expect(importProfile(chromeTraceProfile, '').profiles[0]).toBeInstanceOf(
      ChromeTraceProfile
    );
  });
});
