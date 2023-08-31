import moment from 'moment';

import {
  getDateFromMoment,
  getXAxisDates,
} from 'sentry/views/organizationStats/usageChart/utils';

const TS_START = 1531094400000; // 2018 July 9, 12am UTC
const TS_END = 1531180800000; // 2018 July 10, 12am UTC

describe('getDateFromMoment', () => {
  const start = moment.unix(TS_START / 1000);
  // Ensure date remains in UTC
  it('shows the date if interval is >= 24h', () => {
    expect(getDateFromMoment(start)).toBe('Jul 9');
    expect(getDateFromMoment(start, '2d')).toBe('Jul 9');
    expect(getDateFromMoment(moment('2021-10-31'))).toBe('Oct 31');
  });

  // Ensure datetime is shifted to localtime
  it('shows the date and time if interval is <24h', () => {
    expect(getDateFromMoment(start, '6h')).toBe('Jul 8 8:00 PM - 2:00 AM (-04:00)');
    expect(getDateFromMoment(start, '1h')).toBe('Jul 8 8:00 PM - 9:00 PM (-04:00)');
    expect(getDateFromMoment(start, '5m')).toBe('Jul 8 8:00 PM - 8:05 PM (-04:00)');
  });

  // Ensure datetime is shifted to localtime
  it('coerces date and time into UTC', () => {
    expect(getDateFromMoment(start, '6h', true)).toBe(
      'Jul 9 12:00 AM - 6:00 AM (+00:00)'
    );
    expect(getDateFromMoment(start, '1h', true)).toBe(
      'Jul 9 12:00 AM - 1:00 AM (+00:00)'
    );
    expect(getDateFromMoment(start, '5m', true)).toBe(
      'Jul 9 12:00 AM - 12:05 AM (+00:00)'
    );
  });
});

describe('getXAxisDates', () => {
  // Ensure date remains in UTC
  it('calculates 1d intervals', () => {
    let dates = getXAxisDates(TS_START, TS_END);
    expect(dates).toEqual(['Jul 9', 'Jul 10']);

    dates = getXAxisDates('2021-10-29', '2021-10-31');
    expect(dates).toEqual(['Oct 29', 'Oct 30', 'Oct 31']);
  });

  // Datetime remains in UTC
  it('calculates 4h intervals in UTC', () => {
    const dates = getXAxisDates(TS_START, TS_END, true, '4h');
    expect(dates).toEqual([
      'Jul 9 12:00 AM - 4:00 AM (+00:00)',
      'Jul 9 4:00 AM - 8:00 AM (+00:00)',
      'Jul 9 8:00 AM - 12:00 PM (+00:00)',
      'Jul 9 12:00 PM - 4:00 PM (+00:00)',
      'Jul 9 4:00 PM - 8:00 PM (+00:00)',
      'Jul 9 8:00 PM - 12:00 AM (+00:00)',
      'Jul 10 12:00 AM - 4:00 AM (+00:00)',
    ]);
  });

  // Datetime is shifted to localtime
  it('calculates 4h intervals', () => {
    const dates = getXAxisDates(TS_START, TS_END, false, '4h');
    expect(dates).toEqual([
      'Jul 8 8:00 PM - 12:00 AM (-04:00)',
      'Jul 9 12:00 AM - 4:00 AM (-04:00)',
      'Jul 9 4:00 AM - 8:00 AM (-04:00)',
      'Jul 9 8:00 AM - 12:00 PM (-04:00)',
      'Jul 9 12:00 PM - 4:00 PM (-04:00)',
      'Jul 9 4:00 PM - 8:00 PM (-04:00)',
      'Jul 9 8:00 PM - 12:00 AM (-04:00)',
    ]);
  });

  // Datetime is shifted to localtime
  it('calculates 1h intervals', () => {
    const dates = getXAxisDates(TS_START, TS_END, false, '1h');
    expect(dates).toEqual([
      'Jul 8 8:00 PM - 9:00 PM (-04:00)',
      'Jul 8 9:00 PM - 10:00 PM (-04:00)',
      'Jul 8 10:00 PM - 11:00 PM (-04:00)',
      'Jul 8 11:00 PM - 12:00 AM (-04:00)',
      'Jul 9 12:00 AM - 1:00 AM (-04:00)',
      'Jul 9 1:00 AM - 2:00 AM (-04:00)',
      'Jul 9 2:00 AM - 3:00 AM (-04:00)',
      'Jul 9 3:00 AM - 4:00 AM (-04:00)',
      'Jul 9 4:00 AM - 5:00 AM (-04:00)',
      'Jul 9 5:00 AM - 6:00 AM (-04:00)',
      'Jul 9 6:00 AM - 7:00 AM (-04:00)',
      'Jul 9 7:00 AM - 8:00 AM (-04:00)',
      'Jul 9 8:00 AM - 9:00 AM (-04:00)',
      'Jul 9 9:00 AM - 10:00 AM (-04:00)',
      'Jul 9 10:00 AM - 11:00 AM (-04:00)',
      'Jul 9 11:00 AM - 12:00 PM (-04:00)',
      'Jul 9 12:00 PM - 1:00 PM (-04:00)',
      'Jul 9 1:00 PM - 2:00 PM (-04:00)',
      'Jul 9 2:00 PM - 3:00 PM (-04:00)',
      'Jul 9 3:00 PM - 4:00 PM (-04:00)',
      'Jul 9 4:00 PM - 5:00 PM (-04:00)',
      'Jul 9 5:00 PM - 6:00 PM (-04:00)',
      'Jul 9 6:00 PM - 7:00 PM (-04:00)',
      'Jul 9 7:00 PM - 8:00 PM (-04:00)',
      'Jul 9 8:00 PM - 9:00 PM (-04:00)',
    ]);
  });

  it('handles invalid date strings', () => {
    const dates1 = getXAxisDates('', '');
    expect(dates1).toEqual([]);

    const dates2 = getXAxisDates('sentry', '2021-01-01');
    expect(dates2).toEqual([]);
  });
});
