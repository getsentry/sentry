import {getIntervalOptionsForStatsPeriod} from 'sentry/views/metrics/utils/useMetricsIntervalParam';

describe('getIntervalOptionsForStatsPeriod', () => {
  it('returns options for mixed metrics', () => {
    expect(
      getIntervalOptionsForStatsPeriod(
        {period: '1h', start: null, end: null, utc: null},
        false
      )
    ).toEqual([
      {value: '1m', label: '1 minute'},
      {value: '5m', label: '5 minutes'},
      {value: '15m', label: '15 minutes'},
    ]);

    expect(
      getIntervalOptionsForStatsPeriod(
        {period: '90d', start: null, end: null, utc: null},
        false
      )
    ).toEqual([
      {value: '1d', label: '1 day'},
      {value: '1w', label: '1 week'},
      {value: '4w', label: '1 month'},
    ]);
  });

  it('returns options for custom metrics', () => {
    expect(
      getIntervalOptionsForStatsPeriod(
        {period: '1h', start: null, end: null, utc: null},
        true
      )
    ).toEqual([
      {value: '10s', label: '10 seconds'},
      {value: '1m', label: '1 minute'},
      {value: '5m', label: '5 minutes'},
      {value: '15m', label: '15 minutes'},
    ]);

    expect(
      getIntervalOptionsForStatsPeriod(
        {period: '90d', start: null, end: null, utc: null},
        true
      )
    ).toEqual([
      {value: '1d', label: '1 day'},
      {value: '1w', label: '1 week'},
      {value: '4w', label: '1 month'},
    ]);
  });
});
