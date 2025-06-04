import {getArbitraryRelativePeriod} from 'sentry/components/timeRangeSelector/utils';

describe('getArbitraryRelativePeriod', function () {
  it('parses a well-formed range of hours', function () {
    expect(getArbitraryRelativePeriod('2h')).toEqual({'2h': 'Last 2 hours'});
  });

  it('parses a well-formed range of days', function () {
    expect(getArbitraryRelativePeriod('14d')).toEqual({'14d': 'Last 14 days'});
  });

  it('rejects an malformed range', function () {
    expect(getArbitraryRelativePeriod('hello')).toEqual({});
  });

  it('rejects an unsupported range', function () {
    expect(getArbitraryRelativePeriod('14s')).toEqual({});
  });
});
