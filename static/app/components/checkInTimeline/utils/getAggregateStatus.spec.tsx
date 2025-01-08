import {CheckInStatus} from 'sentry/views/monitors/types';

import {getAggregateStatus} from './getAggregateStatus';
import {generateTestStats, testStatusPrecedent} from './testUtils';

describe('getAggregateStatus', function () {
  it('aggregates correctly', function () {
    const stats = generateTestStats([0, 1, 2, 0, 1]);
    expect(getAggregateStatus(testStatusPrecedent, stats)).toEqual(CheckInStatus.ERROR);
  });
});
