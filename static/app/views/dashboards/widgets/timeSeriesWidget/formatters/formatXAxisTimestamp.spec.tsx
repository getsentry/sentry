import moment from 'moment-timezone';
import {UserFixture} from 'sentry-fixture/user';

import {ConfigStore} from 'sentry/stores/configStore';

import {formatXAxisTimestamp} from './formatXAxisTimestamp';

describe('formatXAxisTimestamp', () => {
  it.each([
    // Year starts
    ['2025-01-01T00:00:00', 'Jan 1st 2025'],
    ['2024-01-01T00:00:00', 'Jan 1st 2024'],
    // Month starts
    ['2025-02-01T00:00:00', 'Feb 1st'],
    ['2024-03-01T00:00:00', 'Mar 1st'],
    // Day starts
    ['2025-02-05T00:00:00', 'Feb 5th'],
    // Hour starts
    ['2025-02-05T12:00:00', '12:00 PM'],
    ['2025-02-05T05:00:00', '5:00 AM'],
    ['2025-02-01T01:00:00', '1:00 AM'],
    // Minute starts
    ['2025-02-05T12:11:00', '12:11 PM'],
    ['2025-02-05T05:25:00', '5:25 AM'],
    // Seconds
    ['2025-02-05T12:10:05', '12:10:05 PM'],
    ['2025-02-05T12:10:06', '12:10:06 PM'],
    ['2025-02-05T05:25:10', '5:25:10 AM'],
  ])('formats %s as %s with 12h format', (raw, formatted) => {
    const user = UserFixture();
    user.options.clock24Hours = false;
    ConfigStore.set('user', user);

    const timestamp = moment.tz(raw, 'UTC').valueOf();
    expect(formatXAxisTimestamp(timestamp, 'UTC')).toEqual(formatted);
  });

  it.each([
    // Minute starts
    ['2025-02-05T12:11:00', '12:11'],
    ['2025-02-05T17:25:00', '17:25'],
    // Seconds
    ['2025-02-05T12:10:05', '12:10:05'],
    ['2025-02-05T12:10:06', '12:10:06'],
    ['2025-02-05T17:25:10', '17:25:10'],
  ])('formats %s as %s with 24h format', (raw, formatted) => {
    const user = UserFixture();
    user.options.clock24Hours = true;
    ConfigStore.set('user', user);

    const timestamp = moment.tz(raw, 'UTC').valueOf();
    expect(formatXAxisTimestamp(timestamp, 'UTC')).toEqual(formatted);
  });

  describe('with non-UTC timezone', () => {
    beforeEach(() => {
      const user = UserFixture();
      user.options.clock24Hours = false;
      ConfigStore.set('user', user);
    });

    it.each([
      // America/New_York (EST, UTC-5)
      ['2025-02-05T05:00:00', 'America/New_York', 'Feb 5th'], // 05:00 UTC = midnight EST → date
      ['2025-02-05T00:00:00', 'America/New_York', '7:00 PM'], // 00:00 UTC = 7:00 PM EST → time
      ['2025-01-01T05:00:00', 'America/New_York', 'Jan 1st 2025'], // midnight Jan 1 EST → year
      ['2025-01-01T00:00:00', 'America/New_York', '7:00 PM'], // still Dec 31 in EST → time
      // Asia/Kolkata (IST, UTC+5:30) — half-hour offset
      ['2024-12-31T18:30:00', 'Asia/Kolkata', 'Jan 1st 2025'], // 18:30 UTC = midnight Jan 1 IST → year
      ['2025-02-04T18:30:00', 'Asia/Kolkata', 'Feb 5th'], // 18:30 UTC = midnight Feb 5 IST → date
      ['2025-02-05T06:30:00', 'Asia/Kolkata', '12:00 PM'], // 06:30 UTC = noon IST → time
      ['2025-02-05T00:00:00', 'Asia/Kolkata', '5:30 AM'], // 00:00 UTC = 5:30 AM IST → time
    ])('formats %s in %s as %s', (raw, timezone, formatted) => {
      const timestamp = moment.tz(raw, 'UTC').valueOf();
      expect(formatXAxisTimestamp(timestamp, timezone)).toEqual(formatted);
    });
  });
});
