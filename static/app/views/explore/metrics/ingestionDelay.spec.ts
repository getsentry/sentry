import {ingestionDelayedRelativePeriod} from 'sentry/views/explore/metrics/ingestionDelay';

function datetime({end = null, period}: {period: string | null; end?: string | null}) {
  return {start: null, end, period, utc: null};
}

describe('ingestionDelayedRelativePeriod', () => {
  it('ends the window at the delay when the range is relative', () => {
    const range = ingestionDelayedRelativePeriod(datetime({period: '24h'}), 120);

    expect(range).toEqual({statsPeriodStart: '24h', statsPeriodEnd: '120s'});
  });

  it.each([
    ['the range is absolute', datetime({period: null, end: '2026-08-02T00:00:00Z'}), 120],
    ['the period is no longer than the delay', datetime({period: '2m'}), 120],
    ['there is no delay to apply', datetime({period: '24h'}), 0],
  ])('returns nothing when %s', (_, selected, delaySeconds) => {
    const range = ingestionDelayedRelativePeriod(selected, delaySeconds);

    expect(range).toBeUndefined();
  });
});
