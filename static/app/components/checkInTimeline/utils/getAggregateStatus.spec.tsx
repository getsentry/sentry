import {CheckInStatus} from 'sentry/views/insights/crons/types';

import {getAggregateStatus} from './getAggregateStatus';
import {generateTestStats, testStatusPrecedent} from './testUtils';

describe('getAggregateStatus', () => {
  it('aggregates correctly', () => {
    const stats = generateTestStats([0, 1, 2, 0, 1]);
    expect(getAggregateStatus(testStatusPrecedent, stats)).toEqual(CheckInStatus.ERROR);
  });
});
