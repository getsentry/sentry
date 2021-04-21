import {getDateFromMoment, getXAxisDates} from 'app/views/usageStats/usageChart/utils';

const TS_START = 1531094400000; // 2018 July 9 UTC
const TS_END = 1531180800000; // 2018 July 10 UTC

describe('getDateFromMoment', () => {
  // Ensure date remains in UTC
  it('shows the date if interval is 1 day or more', () => {
    expect(getDateFromMoment(TS_START)).toBe('Jul 9');
    expect(getDateFromMoment(TS_START, '7d')).toBe('Jul 9');
  });

  // Ensure datetime is shifted to localtime
  it('shows the date amd time if interval is less than a day', () => {
    expect(getDateFromMoment(TS_START, '6h')).toBe('Jul 8 8:00 PM - 2:00 AM');
    expect(getDateFromMoment(TS_START, '1h')).toBe('Jul 8 8:00 PM - 9:00 PM');
    expect(getDateFromMoment(TS_START, '5m')).toBe('Jul 8 8:00 PM - 8:05 PM');
  });
});

describe('getXAxisDates', () => {
  // Ensure date remains in UTC
  it('calculates 1d intervals', () => {
    const dates = getXAxisDates(TS_START, TS_END);
    expect(dates).toEqual(['Jul 9', 'Jul 10']);
  });

  // Ensure datetime is shifted to localtime
  it('calculates 4h intervals', () => {
    const dates = getXAxisDates(TS_START, TS_END, '4h');
    expect(dates).toEqual([
      'Jul 8 8:00 PM - 12:00 AM',
      'Jul 9 12:00 AM - 4:00 AM',
      'Jul 9 4:00 AM - 8:00 AM',
      'Jul 9 8:00 AM - 12:00 PM',
      'Jul 9 12:00 PM - 4:00 PM',
      'Jul 9 4:00 PM - 8:00 PM',
      'Jul 9 8:00 PM - 12:00 AM',
    ]);
  });

  // Ensure datetime is shifted to localtime
  it('calculates 1h intervals', () => {
    const dates = getXAxisDates(TS_START, TS_END, '1h');
    expect(dates).toEqual([
      'Jul 8 8:00 PM - 9:00 PM',
      'Jul 8 9:00 PM - 10:00 PM',
      'Jul 8 10:00 PM - 11:00 PM',
      'Jul 8 11:00 PM - 12:00 AM',
      'Jul 9 12:00 AM - 1:00 AM',
      'Jul 9 1:00 AM - 2:00 AM',
      'Jul 9 2:00 AM - 3:00 AM',
      'Jul 9 3:00 AM - 4:00 AM',
      'Jul 9 4:00 AM - 5:00 AM',
      'Jul 9 5:00 AM - 6:00 AM',
      'Jul 9 6:00 AM - 7:00 AM',
      'Jul 9 7:00 AM - 8:00 AM',
      'Jul 9 8:00 AM - 9:00 AM',
      'Jul 9 9:00 AM - 10:00 AM',
      'Jul 9 10:00 AM - 11:00 AM',
      'Jul 9 11:00 AM - 12:00 PM',
      'Jul 9 12:00 PM - 1:00 PM',
      'Jul 9 1:00 PM - 2:00 PM',
      'Jul 9 2:00 PM - 3:00 PM',
      'Jul 9 3:00 PM - 4:00 PM',
      'Jul 9 4:00 PM - 5:00 PM',
      'Jul 9 5:00 PM - 6:00 PM',
      'Jul 9 6:00 PM - 7:00 PM',
      'Jul 9 7:00 PM - 8:00 PM',
      'Jul 9 8:00 PM - 9:00 PM',
    ]);
  });
});
