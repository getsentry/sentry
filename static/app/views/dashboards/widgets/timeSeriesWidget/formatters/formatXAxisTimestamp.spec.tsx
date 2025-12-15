import moment from 'moment-timezone';
import {UserFixture} from 'sentry-fixture/user';

import ConfigStore from 'sentry/stores/configStore';

import {computeXAxisConfig, formatXAxisTimestamp} from './formatXAxisTimestamp';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

describe('formatXAxisTimestamp', () => {
  beforeEach(() => {
    const user = UserFixture();
    user.options.clock24Hours = false;
    ConfigStore.set('user', user);
  });

  it('formats as date for multi-day ranges', () => {
    const timestamp = moment.utc('2025-02-05T12:00:00').valueOf();
    expect(
      formatXAxisTimestamp(timestamp, {timezone: 'UTC', durationMs: 7 * DAY_MS})
    ).toBe('Feb 5th');
  });

  it('formats year start with year for multi-day ranges', () => {
    const timestamp = moment.utc('2025-01-01T00:00:00').valueOf();
    expect(
      formatXAxisTimestamp(timestamp, {timezone: 'UTC', durationMs: 7 * DAY_MS})
    ).toBe('Jan 1st 2025');
  });

  it('formats as time for single-day ranges', () => {
    const timestamp = moment.utc('2025-02-05T12:00:00').valueOf();
    expect(
      formatXAxisTimestamp(timestamp, {timezone: 'UTC', durationMs: 12 * HOUR_MS})
    ).toBe('12:00 PM');
  });

  it('respects 24h format setting', () => {
    const user = UserFixture();
    user.options.clock24Hours = true;
    ConfigStore.set('user', user);

    const timestamp = moment.utc('2025-02-05T17:30:00').valueOf();
    expect(
      formatXAxisTimestamp(timestamp, {timezone: 'UTC', durationMs: 6 * HOUR_MS})
    ).toBe('17:30');
  });

  it('formats in user timezone', () => {
    const timestamp = moment.utc('2025-02-05T12:00:00').valueOf();
    expect(
      formatXAxisTimestamp(timestamp, {
        timezone: 'America/New_York',
        durationMs: 6 * HOUR_MS,
      })
    ).toBe('7:00 AM');
  });
});

describe('computeXAxisConfig', () => {
  it('returns undefined when start or end is undefined', () => {
    expect(computeXAxisConfig(undefined, 1000, 'UTC')).toBeUndefined();
    expect(computeXAxisConfig(1000, undefined, 'UTC')).toBeUndefined();
    expect(computeXAxisConfig(undefined, undefined, 'UTC')).toBeUndefined();
  });

  it('selects 10 minute interval for 1 hour range', () => {
    const start = moment.utc('2025-02-05T10:00:00').valueOf();
    const end = moment.utc('2025-02-05T11:00:00').valueOf();
    const config = computeXAxisConfig(start, end, 'UTC');
    expect(config?.interval).toBe(10 * MINUTE_MS);
  });

  it('selects 1 hour interval for 6 hour range', () => {
    const start = moment.utc('2025-02-05T08:00:00').valueOf();
    const end = moment.utc('2025-02-05T14:00:00').valueOf();
    const config = computeXAxisConfig(start, end, 'UTC');
    expect(config?.interval).toBe(HOUR_MS);
  });

  it('selects 4 hour interval for 24 hour range', () => {
    const start = moment.utc('2025-02-05T00:00:00').valueOf();
    const end = moment.utc('2025-02-06T00:00:00').valueOf();
    const config = computeXAxisConfig(start, end, 'UTC');
    expect(config?.interval).toBe(4 * HOUR_MS);
  });

  it('selects 1 day interval for 7 day range', () => {
    const start = moment.utc('2025-02-01T00:00:00').valueOf();
    const end = moment.utc('2025-02-08T00:00:00').valueOf();
    const config = computeXAxisConfig(start, end, 'UTC');
    expect(config?.interval).toBe(DAY_MS);
  });

  it('sets labelInterval for periodic hiding when many ticks', () => {
    const start = moment.utc('2025-02-01T00:00:00').valueOf();
    const end = moment.utc('2025-02-08T00:00:00').valueOf();
    const config = computeXAxisConfig(start, end, 'UTC', 3);
    expect(config?.labelInterval).toBeGreaterThan(0);
  });
});
