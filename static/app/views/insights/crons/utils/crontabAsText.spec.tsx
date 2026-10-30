import {shouldUse24Hours} from 'sentry/utils/dates';

import {crontabAsText} from './crontabAsText';

jest.mock('sentry/utils/dates');

describe('crontabAsText', () => {
  beforeEach(() => {
    jest.mocked(shouldUse24Hours).mockReturnValue(false);
  });

  it('translates simple crontab', () => {
    expect(crontabAsText('* * * * *')).toBe('Every minute');
    expect(crontabAsText('10 * * * *')).toBe('At 10 minutes past the hour');
  });

  it('handles 24 hour clock', () => {
    expect(crontabAsText('0 5/* * 1-5 *')).toBe(
      'At 0 minutes past the hour, every * hours, starting at 05:00 AM, January through May'
    );

    jest.mocked(shouldUse24Hours).mockReturnValue(true);

    expect(crontabAsText('0 5/* * 1-5 *')).toBe(
      'At 0 minutes past the hour, every * hours, starting at 05:00, January through May'
    );
  });

  it('translates day of week ranges', () => {
    expect(crontabAsText('0 9 * * 1-5')).toBe('At 09:00 AM, Monday through Friday');
    expect(crontabAsText('0 9 * * 6-7')).toBe('At 09:00 AM, Saturday through Sunday');
    expect(crontabAsText('0 9 * * 0-6')).toBe('At 09:00 AM, Sunday through Saturday');
    expect(crontabAsText('0 9 * * 5-7/2')).toBe(
      'At 09:00 AM, every 2 days of the week, Friday through Sunday'
    );
    expect(crontabAsText('0 9 * * sun')).toBe('At 09:00 AM, only on Sunday');
    expect(crontabAsText('0 0 1 * *')).toBe('At 12:00 AM, on day 1 of the month');
  });

  it('returns null for unsupported "no specific value" marker (?)', () => {
    expect(crontabAsText('0 0 ? * *')).toBeNull();
    expect(crontabAsText('0 0 * * ?')).toBeNull();
  });

  it('returns null for unsupported weekday marker (W)', () => {
    expect(crontabAsText('0 0 15W * *')).toBeNull();
    expect(crontabAsText('0 0 LW * *')).toBeNull();
  });

  it('returns null for expressions with more than 5 fields', () => {
    expect(crontabAsText('0 0 * * * *')).toBeNull();
    expect(crontabAsText('0 0 0 * * * *')).toBeNull();
  });

  it('returns null for invalid expressions', () => {
    expect(crontabAsText('invalid')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(crontabAsText(null)).toBeNull();
  });

  it('handles extra whitespace in expressions', () => {
    // Should not reject valid 5-field expressions with extra spaces
    expect(crontabAsText('0  0  *  *  *')).toBe('At 12:00 AM');
    expect(crontabAsText('0   0   *   *   *')).toBe('At 12:00 AM');
  });
});
