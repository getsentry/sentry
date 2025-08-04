import {Dataset, TimePeriod, TimeWindow} from 'sentry/views/alerts/rules/metric/types';

import {getTimePeriodOptions} from './timePeriods';

describe('getTimePeriodOptions', () => {
  it('returns empty array for crash-free alerts with unsupported time window', () => {
    const options = getTimePeriodOptions({
      dataset: Dataset.SESSIONS,
      timeWindow: TimeWindow.ONE_MINUTE,
    });

    expect(options).toEqual([]);
  });

  it('returns EAP-specific options (excluding 14 days) for events analytics platform', () => {
    const options = getTimePeriodOptions({
      dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
      timeWindow: TimeWindow.ONE_HOUR,
    });

    expect(options).toEqual([
      {value: TimePeriod.ONE_DAY, label: 'Last 24 hours'},
      {value: TimePeriod.THREE_DAYS, label: 'Last 3 days'},
      {value: TimePeriod.SEVEN_DAYS, label: 'Last 7 days'},
    ]);
  });
});
