import {getArbitraryRelativePeriod} from 'sentry/components/timeRangeSelector/utils';

describe('getArbitraryRelativePeriod', () => {
  it('parses a well-formed range of hours', () => {
    expect(getArbitraryRelativePeriod('2h')).toEqual({'2h': 'Last 2 hours'});
  });

  it('parses a well-formed range of days', () => {
    expect(getArbitraryRelativePeriod('14d')).toEqual({'14d': 'Last 14 days'});
  });

  it('rejects an malformed range', () => {
    expect(getArbitraryRelativePeriod('hello')).toEqual({});
  });

  it('rejects an unsupported range', () => {
    expect(getArbitraryRelativePeriod('14s')).toEqual({});
  });
});
