import {CheckInStatus} from 'sentry/views/monitors/types';

import {getAggregateStatusFromMultipleBuckets} from './getAggregateStatusFromMultipleBuckets';
import {generateTestStats, testStatusPrecedent} from './testUtils';

describe('getAggregateStatusFromMultipleBuckets', function () {
  it('aggregates correctly across multiple envs', function () {
    const stats1 = generateTestStats([2, 1, 2, 1, 0]);
    const stats2 = generateTestStats([1, 2, 0, 0, 0]);
    const stats3 = generateTestStats([1, 1, 1, 3, 0]);

    const status = getAggregateStatusFromMultipleBuckets(testStatusPrecedent, [
      stats1,
      stats2,
      stats3,
    ]);

    expect(status).toEqual(CheckInStatus.TIMEOUT);
  });
});
