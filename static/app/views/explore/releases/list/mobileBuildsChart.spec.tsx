import {getSelectedTimeRange} from 'sentry/views/explore/releases/list/mobileBuildsChart';

const DAY = 24 * 60 * 60 * 1000;

describe('getSelectedTimeRange', () => {
  const now = Date.UTC(2026, 9, 15, 12);

  it('spans a relative period ending now', () => {
    expect(
      getSelectedTimeRange({period: '14d', start: null, end: null, utc: null}, now)
    ).toEqual({start: now - 14 * DAY, end: now});
  });

  it('spans the absolute dates when there is no period', () => {
    expect(
      getSelectedTimeRange(
        {
          period: null,
          start: '2026-10-01T00:00:00.000Z',
          end: '2026-10-08T00:00:00.000Z',
          utc: true,
        },
        now
      )
    ).toEqual({start: Date.UTC(2026, 9, 1), end: Date.UTC(2026, 9, 8)});
  });

  it('prefers a relative period over absolute dates', () => {
    expect(
      getSelectedTimeRange(
        {
          period: '24h',
          start: '2026-10-01T00:00:00.000Z',
          end: '2026-10-08T00:00:00.000Z',
          utc: null,
        },
        now
      )
    ).toEqual({start: now - DAY, end: now});
  });

  it('falls back to the default period', () => {
    expect(
      getSelectedTimeRange({period: null, start: null, end: null, utc: null}, now)
    ).toEqual({start: now - 14 * DAY, end: now});
  });
});
