import {getAbsoluteRangeFromPeriod} from 'sentry/utils/duration/getAbsoluteRangeFromPeriod';

describe('getAbsoluteRangeFromPeriod', () => {
  const now = new Date('2026-09-03T12:00:00.000Z').getTime();

  it('returns a range ending now when given a valid period', () => {
    expect(getAbsoluteRangeFromPeriod('7d', now)).toEqual({
      start: new Date('2026-08-27T12:00:00.000Z'),
      end: new Date('2026-09-03T12:00:00.000Z'),
    });
  });

  it('returns null when the period cannot be parsed', () => {
    expect(getAbsoluteRangeFromPeriod('yesterday', now)).toBeNull();
  });
});
