import {projectStatsToSampleRates} from 'sentry/views/settings/project/server-side-sampling/utils/projectStatsToSampleRates';

describe('projectStatsToSampleRates', function () {
  it('returns correct sample rates', function () {
    expect(projectStatsToSampleRates(TestStubs.Outcomes())).toEqual({
      hoursOverLimit: 18,
      maxSafeSampleRate: 0.3249,
      trueSampleRate: 1,
    });
  });
});
