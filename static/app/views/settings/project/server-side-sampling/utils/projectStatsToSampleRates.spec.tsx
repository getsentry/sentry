import {Outcomes} from 'fixtures/js-stubs/outcomes.js';

import {projectStatsToSampleRates} from 'sentry/views/settings/project/server-side-sampling/utils/projectStatsToSampleRates';

describe('projectStatsToSampleRates', function () {
  it('returns correct sample rates', function () {
    expect(projectStatsToSampleRates(Outcomes())).toEqual({
      hoursOverLimit: 1,
      maxSafeSampleRate: 0.95,
      trueSampleRate: 1,
    });
  });
});
