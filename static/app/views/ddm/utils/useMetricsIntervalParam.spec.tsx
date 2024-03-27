import {getIntervalOptionsForStatsPeriod} from 'sentry/views/ddm/utils/useMetricsIntervalParam';

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
      {value: '24h', label: '24 hours'},
      {value: '2d', label: '2 days'},
      {value: '7d', label: '7 days'},
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
      {value: '24h', label: '24 hours'},
      {value: '2d', label: '2 days'},
      {value: '7d', label: '7 days'},
    ]);
  });
});
