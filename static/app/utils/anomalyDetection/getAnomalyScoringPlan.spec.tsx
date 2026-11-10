import {getAnomalyScoringPlan, getAnomalyScoringWarning} from './getAnomalyScoringPlan';

function relative(period: string) {
  return {period, start: null, end: null, utc: false};
}

describe('getAnomalyScoringPlan', () => {
  it.each([
    // [range, chart interval, scoring interval, scored days]
    ['24h', '5m', '5m', 1],
    ['24h', '30m', '30m', 1],
    ['7d', '1h', '1h', 7],
    ['2d', '15m', '15m', 2],
  ])('scores %s at %s as-is', (period, interval, expected, days) => {
    expect(getAnomalyScoringPlan(relative(period), interval)).toMatchObject({
      interval: expected,
      scoredMinutes: days * 24 * 60,
      isResampled: false,
      isPartial: false,
    });
  });

  it.each([
    ['1h', '1m', '5m'],
    ['24h', '10m', '5m'],
    ['3d', '10m', '5m'],
    ['7d', '3h', '1h'],
    ['14d', '6h', '1h'],
    ['14d', '1d', '1h'],
  ])('scores %s at %s using %s', (period, interval, expected) => {
    expect(getAnomalyScoringPlan(relative(period), interval)).toMatchObject({
      interval: expected,
      isResampled: true,
      isPartial: false,
    });
  });

  it('steps up when the range is longer than Seer scores at the chart interval', () => {
    // 5m covers 7 days and 15m covers 15, so a 10-day 5m chart uses 15m
    expect(getAnomalyScoringPlan(relative('10d'), '5m')).toMatchObject({
      interval: '15m',
      historyDays: 15,
      isResampled: true,
      isPartial: false,
    });
  });

  it('only scores the last 28 days of longer ranges', () => {
    expect(getAnomalyScoringPlan(relative('90d'), '1d')).toEqual({
      interval: '1h',
      intervalMinutes: 60,
      historyDays: 28,
      scoredMinutes: 28 * 24 * 60,
      isPartial: true,
      isResampled: true,
    });
  });
});

describe('getAnomalyScoringWarning', () => {
  it('says nothing when the chart is scored as-is', () => {
    expect(
      getAnomalyScoringWarning(getAnomalyScoringPlan(relative('24h'), '5m'), '5m')
    ).toBeNull();
  });

  it('warns when the chart is scored at a different interval', () => {
    expect(
      getAnomalyScoringWarning(getAnomalyScoringPlan(relative('7d'), '3h'), '3h')
    ).toBe('Detected at 1h, so markers may not line up with 3h buckets');
  });

  it('warns when only part of the chart is scored', () => {
    expect(
      getAnomalyScoringWarning(getAnomalyScoringPlan(relative('30d'), '1h'), '1h')
    ).toBe('Only the last 28 days are checked');
    expect(
      getAnomalyScoringWarning(getAnomalyScoringPlan(relative('90d'), '1d'), '1d')
    ).toBe(
      'Detected at 1h, so markers may not line up with 1d buckets. Only the last 28 days are checked'
    );
  });
});
