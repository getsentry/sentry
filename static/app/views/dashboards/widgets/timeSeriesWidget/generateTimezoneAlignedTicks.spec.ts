import moment from 'moment-timezone';

import {generateTimezoneAlignedTicks} from './generateTimezoneAlignedTicks';

describe('generateTimezoneAlignedTicks', () => {
  describe('interval selection', () => {
    it.each<[number, number, (m: moment.Moment) => void]>([
      [5 * 60 * 1000, 5, assertAtMinuteBoundary], // 5 minutes → minute ticks
      [3600 * 1000, 5, assertAtMinuteBoundary], // 1 hour → minute ticks
      [6 * 3600 * 1000, 5, assertAtHourBoundary], // 6 hours → hour ticks
      [24 * 3600 * 1000, 5, assertAtHourBoundary], // 24 hours → hour ticks
      [7 * 86400 * 1000, 5, assertAtDayBoundary], // 7 days → day ticks
      [30 * 86400 * 1000, 5, assertAtDayBoundary], // 30 days → day ticks
      [90 * 86400 * 1000, 5, assertAtMonthBoundary], // 90 days → month ticks
      [365 * 86400 * 1000, 5, assertAtMonthBoundary], // 365 days → month ticks
      [3 * 365 * 86400 * 1000, 5, assertAtYearBoundary], // 3 years → year ticks
    ])(
      'selects correct-level ticks for a %d ms range with %d splits',
      (rangeMs, splitNumber, assertTick) => {
        const base = Date.UTC(2025, 0, 1);
        const ticks = generateTimezoneAlignedTicks(
          base,
          base + rangeMs,
          splitNumber,
          'UTC'
        );

        expect(ticks.length).toBeGreaterThan(0);
        for (const tick of ticks) {
          assertTick(moment.utc(tick));
        }
      }
    );
  });

  describe('timezone alignment', () => {
    it('places ticks at PST midnight boundaries for America/Los_Angeles', () => {
      const tz = 'America/Los_Angeles';
      const start = toEpochMs('2025-01-15 00:00:00', tz);
      const end = toEpochMs('2025-01-16 00:00:00', tz);

      const ticks = generateTimezoneAlignedTicks(start, end, 5, tz);

      for (const tick of ticks) {
        assertAtHourBoundary(moment.tz(tick, tz));
      }

      const ticksFormatted = ticks.map(t => formatInTz(t, tz, 'HH:mm'));
      expect(ticksFormatted).toContain('00:00');
    });

    it('places ticks at IST boundaries for Asia/Kolkata (UTC+5:30)', () => {
      const tz = 'Asia/Kolkata';
      const start = toEpochMs('2025-01-15 00:00:00', tz);
      const end = toEpochMs('2025-01-16 00:00:00', tz);

      const ticks = generateTimezoneAlignedTicks(start, end, 5, tz);

      for (const tick of ticks) {
        assertAtHourBoundary(moment.tz(tick, tz));
      }

      // IST midnight = 18:30 UTC previous day — verify UTC timestamps have :30 minutes
      const midnightTick = ticks.find(t => moment.tz(t, tz).hour() === 0);
      if (midnightTick) {
        expect(moment.utc(midnightTick).minute()).toBe(30);
      }
    });

    it('places ticks at UTC round boundaries when timezone is UTC', () => {
      const start = Date.UTC(2025, 0, 15, 0, 0, 0);
      const end = Date.UTC(2025, 0, 16, 0, 0, 0);

      const ticks = generateTimezoneAlignedTicks(start, end, 5, 'UTC');

      for (const tick of ticks) {
        assertAtHourBoundary(moment.utc(tick));
      }
    });
  });

  describe('DST transitions', () => {
    it('handles spring forward (America/New_York, March 2025)', () => {
      const tz = 'America/New_York';
      // DST transition: March 9, 2025 at 2:00 AM → 3:00 AM
      const start = toEpochMs('2025-03-07 00:00:00', tz);
      const end = toEpochMs('2025-03-12 00:00:00', tz);

      const ticks = generateTimezoneAlignedTicks(start, end, 5, tz);

      for (const tick of ticks) {
        assertAtDayBoundary(moment.tz(tick, tz));
      }

      // Check that the gap between ticks spanning DST is 23 hours (not 24)
      const march9 = ticks.find(t => moment.tz(t, tz).date() === 9);
      const march10 = ticks.find(t => moment.tz(t, tz).date() === 10);
      if (march9 && march10) {
        const gapHours = (march10 - march9) / (3600 * 1000);
        expect(gapHours).toBe(23); // Spring forward: 23 hours between midnights
      }
    });

    it('handles fall back (America/New_York, November 2025)', () => {
      const tz = 'America/New_York';
      // DST transition: November 2, 2025 at 2:00 AM → 1:00 AM
      const start = toEpochMs('2025-10-31 00:00:00', tz);
      const end = toEpochMs('2025-11-05 00:00:00', tz);

      const ticks = generateTimezoneAlignedTicks(start, end, 5, tz);

      for (const tick of ticks) {
        assertAtDayBoundary(moment.tz(tick, tz));
      }

      // Check that the gap spanning fall back is 25 hours
      const nov2 = ticks.find(t => moment.tz(t, tz).date() === 2);
      const nov3 = ticks.find(t => moment.tz(t, tz).date() === 3);
      if (nov2 && nov3) {
        const gapHours = (nov3 - nov2) / (3600 * 1000);
        expect(gapHours).toBe(25); // Fall back: 25 hours between midnights
      }
    });
  });

  describe('half-hour timezones', () => {
    it('handles Asia/Kolkata (+5:30) multi-day span', () => {
      const tz = 'Asia/Kolkata';
      const start = toEpochMs('2025-01-10 00:00:00', tz);
      const end = toEpochMs('2025-01-20 00:00:00', tz);

      const ticks = generateTimezoneAlignedTicks(start, end, 5, tz);

      for (const tick of ticks) {
        assertAtDayBoundary(moment.tz(tick, tz));
      }
    });

    it('handles Asia/Kathmandu (+5:45)', () => {
      const tz = 'Asia/Kathmandu';
      const start = toEpochMs('2025-01-15 00:00:00', tz);
      const end = toEpochMs('2025-01-16 00:00:00', tz);

      const ticks = generateTimezoneAlignedTicks(start, end, 5, tz);

      for (const tick of ticks) {
        assertAtHourBoundary(moment.tz(tick, tz));
      }
    });
  });

  describe('edge cases', () => {
    it('returns empty array when start equals end', () => {
      const ts = Date.UTC(2025, 0, 15);
      expect(generateTimezoneAlignedTicks(ts, ts, 5, 'UTC')).toEqual([]);
    });

    it('returns empty array when start > end', () => {
      const start = Date.UTC(2025, 0, 16);
      const end = Date.UTC(2025, 0, 15);
      expect(generateTimezoneAlignedTicks(start, end, 5, 'UTC')).toEqual([]);
    });

    it('returns empty array when splitNumber is 0', () => {
      const start = Date.UTC(2025, 0, 15);
      const end = Date.UTC(2025, 0, 16);
      expect(generateTimezoneAlignedTicks(start, end, 0, 'UTC')).toEqual([]);
    });

    it('handles very long span (>10 years)', () => {
      const start = Date.UTC(2015, 0, 1);
      const end = Date.UTC(2026, 0, 1);

      const ticks = generateTimezoneAlignedTicks(start, end, 5, 'UTC');

      expect(ticks.length).toBeGreaterThan(0);
      expect(ticks.length).toBeLessThan(20);

      for (const tick of ticks) {
        const m = moment.utc(tick);
        expect(m.month()).toBe(0);
        expect(m.date()).toBe(1);
      }
    });
  });

  describe('tick count', () => {
    it.each([
      [0, 3600 * 1000], // 1 hour
      [0, 24 * 3600 * 1000], // 24 hours
      [0, 7 * 86400 * 1000], // 7 days
      [0, 30 * 86400 * 1000], // 30 days
      [0, 90 * 86400 * 1000], // 90 days
    ])(
      'produces roughly splitNumber ticks for offset %d to %d',
      (startOffset, endOffset) => {
        const base = Date.UTC(2025, 0, 1);
        const splitNumber = 5;
        const ticks = generateTimezoneAlignedTicks(
          base + startOffset,
          base + endOffset,
          splitNumber,
          'UTC'
        );

        // Allow splitNumber ± 5 (boundary extension adds extra ticks)
        expect(ticks.length).toBeGreaterThanOrEqual(splitNumber - 5);
        expect(ticks.length).toBeLessThanOrEqual(splitNumber + 5);
      }
    );
  });

  describe('tick ordering and range', () => {
    it('returns ticks in ascending order', () => {
      const start = Date.UTC(2025, 0, 1);
      const end = Date.UTC(2025, 1, 1);

      const ticks = generateTimezoneAlignedTicks(start, end, 5, 'America/New_York');

      for (let i = 1; i < ticks.length; i++) {
        expect(ticks[i]).toBeGreaterThan(ticks[i - 1]!);
      }
    });

    it('only places ticks within the data range', () => {
      const start = Date.UTC(2025, 0, 15, 14, 30, 0);
      const end = Date.UTC(2025, 0, 22, 14, 30, 0);

      const ticks = generateTimezoneAlignedTicks(start, end, 10, 'UTC');

      for (const tick of ticks) {
        expect(tick).toBeGreaterThanOrEqual(start);
        expect(tick).toBeLessThanOrEqual(end);
      }
    });
  });
});

function assertAtYearBoundary(m: moment.Moment) {
  expect(m.month()).toBe(0);
  expect(m.date()).toBe(1);
  expect(m.hour()).toBe(0);
}

function assertAtMonthBoundary(m: moment.Moment) {
  expect(m.date()).toBe(1);
  expect(m.hour()).toBe(0);
}

function assertAtDayBoundary(m: moment.Moment) {
  expect(m.hour()).toBe(0);
  expect(m.minute()).toBe(0);
}

function assertAtHourBoundary(m: moment.Moment) {
  expect(m.minute()).toBe(0);
  expect(m.second()).toBe(0);
}

function assertAtMinuteBoundary(m: moment.Moment) {
  expect(m.second()).toBe(0);
}

/** Convert a timezone-local datetime string to UTC epoch milliseconds. */
function toEpochMs(dateStr: string, timezone: string): number {
  return moment.tz(dateStr, timezone).valueOf();
}

/** Format a UTC ms timestamp in a timezone for readable assertions. */
function formatInTz(ms: number, timezone: string, fmt = 'YYYY-MM-DD HH:mm:ss'): string {
  return moment.tz(ms, timezone).format(fmt);
}
