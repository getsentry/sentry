import moment from 'moment-timezone';
import {UserFixture} from 'sentry-fixture/user';

import ConfigStore from 'sentry/stores/configStore';

import {formatXAxisTimestamp} from './formatXAxisTimestamp';

describe('formatXAxisTimestamp', () => {
  it.each([
    // Year starts
    ['2025-01-01T00:00:00', 'Jan 1st 2025'],
    ['2024-01-01T00:00:00', 'Jan 1st 2024'],
    // // Month starts
    ['2025-02-01T00:00:00', 'Feb 1st'],
    ['2024-03-01T00:00:00', 'Mar 1st'],
    // // Day starts
    ['2025-02-05T00:00:00', 'Feb 5th'],
    // // Hour starts
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
  ])('formats %s as %s with 12h format (UTC mode)', (raw, formatted) => {
    const user = UserFixture();
    user.options.clock24Hours = false;
    ConfigStore.set('user', user);

    const timestamp = moment(raw).unix() * 1000;
    expect(formatXAxisTimestamp(timestamp, {utc: true})).toEqual(formatted);
  });

  it.each([
    // Minute starts
    ['2025-02-05T12:11:00', '12:11'],
    ['2025-02-05T17:25:00', '17:25'],
    // Seconds
    ['2025-02-05T12:10:05', '12:10:05'],
    ['2025-02-05T12:10:06', '12:10:06'],
    ['2025-02-05T17:25:10', '17:25:10'],
  ])('formats %s as %s with 24h format (UTC mode)', (raw, formatted) => {
    const user = UserFixture();
    user.options.clock24Hours = true;
    ConfigStore.set('user', user);

    const timestamp = moment(raw).unix() * 1000;
    expect(formatXAxisTimestamp(timestamp, {utc: true})).toEqual(formatted);
  });

  it.each([
    // Year starts (local midnight on New Year's)
    ['2025-01-01T05:00:00Z', 'Jan 1st 2025'], // 5:00 AM UTC = midnight EST on New Year's
    ['2024-01-01T05:00:00Z', 'Jan 1st 2024'], // 5:00 AM UTC = midnight EST on New Year's
    // Month starts (local midnight on 1st of month)
    ['2025-02-01T05:00:00Z', 'Feb 1st'], // 5:00 AM UTC = midnight EST
    ['2024-03-01T05:00:00Z', 'Mar 1st'], // 5:00 AM UTC = midnight EST
    // Day starts (local midnight)
    ['2025-02-05T05:00:00Z', 'Feb 5th'], // 5:00 AM UTC = midnight EST
    ['2025-07-15T04:00:00Z', 'Jul 15th'], // 4:00 AM UTC = midnight EDT (daylight time)
    // Hour boundaries (non-midnight) - should show time
    ['2025-02-05T12:00:00Z', '12:00 PM'], // Noon UTC = 7:00 AM EST
    ['2025-02-05T20:00:00Z', '8:00 PM'], // 8:00 PM UTC = 3:00 PM EST
    ['2025-02-01T06:00:00Z', '6:00 AM'], // 6:00 AM UTC = 1:00 AM EST
    // Minute starts
    ['2025-02-05T12:11:00Z', '12:11 PM'], // 12:11 PM UTC
    ['2025-02-05T20:25:00Z', '8:25 PM'], // 8:25 PM UTC
    // Seconds
    ['2025-02-05T12:10:05Z', '12:10:05 PM'], // 12:10:05 PM UTC
    ['2025-02-05T12:10:06Z', '12:10:06 PM'], // 12:10:06 PM UTC
    ['2025-02-05T20:25:10Z', '8:25:10 PM'], // 8:25:10 PM UTC
  ])('formats %s as %s with 12h format (local mode)', (raw, formatted) => {
    const user = UserFixture();
    user.options.clock24Hours = false;
    ConfigStore.set('user', user);

    const timestamp = moment(raw).unix() * 1000;
    expect(formatXAxisTimestamp(timestamp)).toEqual(formatted); // No utc option = local mode
  });
});
