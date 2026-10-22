import {widenDateRangeToInterval} from 'sentry/views/detectors/utils/widenDateRangeToInterval';

const HOUR_SECONDS = 60 * 60;

const NOW_MILLISECONDS = new Date('2026-01-10T00:00:00Z').getTime();

describe('widenDateRangeToInterval', () => {
  it('keeps a custom range spanning at least three intervals', () => {
    const dateRange = {
      start: '2026-01-01T00:00:00',
      end: '2026-01-01T03:00:00',
      statsPeriod: undefined,
    };

    const widenedDateRange = widenDateRangeToInterval({
      dateRange,
      intervalSeconds: HOUR_SECONDS,
      nowMilliseconds: NOW_MILLISECONDS,
    });

    expect(widenedDateRange).toEqual(dateRange);
  });

  it('centers a short custom range on the original selection', () => {
    const widenedDateRange = widenDateRangeToInterval({
      dateRange: {
        start: '2026-01-05T10:00:00',
        end: '2026-01-05T10:30:00',
        statsPeriod: undefined,
      },
      intervalSeconds: 4 * HOUR_SECONDS,
      nowMilliseconds: NOW_MILLISECONDS,
    });

    expect(widenedDateRange).toEqual({
      start: '2026-01-05T04:15:00',
      end: '2026-01-05T16:15:00',
      statsPeriod: undefined,
    });
  });

  it('shifts a short custom range near now so it ends at now', () => {
    const widenedDateRange = widenDateRangeToInterval({
      dateRange: {
        start: '2026-01-09T23:30:00',
        end: '2026-01-09T23:50:00',
        statsPeriod: undefined,
      },
      intervalSeconds: HOUR_SECONDS,
      nowMilliseconds: NOW_MILLISECONDS,
    });

    expect(widenedDateRange).toEqual({
      start: '2026-01-09T21:00:00',
      end: '2026-01-10T00:00:00',
      statsPeriod: undefined,
    });
  });

  it('falls back to the last interval when the custom range is invalid', () => {
    const widenedDateRange = widenDateRangeToInterval({
      dateRange: {
        start: 'not-a-date',
        end: '2026-01-01T01:00:00',
        statsPeriod: undefined,
      },
      intervalSeconds: 4 * HOUR_SECONDS,
      nowMilliseconds: NOW_MILLISECONDS,
    });

    expect(widenedDateRange).toEqual({
      start: undefined,
      end: undefined,
      statsPeriod: '4h',
    });
  });

  it('replaces a stats period shorter than one interval with the last interval', () => {
    const widenedDateRange = widenDateRangeToInterval({
      dateRange: {start: undefined, end: undefined, statsPeriod: '1h'},
      intervalSeconds: 4 * HOUR_SECONDS,
      nowMilliseconds: NOW_MILLISECONDS,
    });

    expect(widenedDateRange).toEqual({
      start: undefined,
      end: undefined,
      statsPeriod: '4h',
    });
  });
});
