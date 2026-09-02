import moment from 'moment-timezone';

import {
  getArbitraryRelativePeriod,
  parseStatsPeriod,
} from 'sentry/components/timeRangeSelector/utils';

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

describe('parseStatsPeriod', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2001-11-15T12:34:56.789Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('parses a range of hours', () => {
    const {start, end} = parseStatsPeriod('2h');

    expect(moment(end).diff(moment(start), 'hours')).toBe(2);
  });

  it('parses a range of seconds', () => {
    const {start, end} = parseStatsPeriod('3600s');

    expect(moment(end).diff(moment(start), 'seconds')).toBe(3600);
  });

  it('throws when the period is malformed', () => {
    expect(() => parseStatsPeriod('hello')).toThrow('Invalid stats period');
  });
});
