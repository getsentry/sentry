import {getEventGraphInterval, getMaxBars} from './eventGraphInterval';

describe('getEventGraphInterval', () => {
  it('uses more bars in a wider chart', () => {
    expect(getEventGraphInterval({period: '7d'}, getMaxBars(400))).toBe('3h');
    expect(getEventGraphInterval({period: '7d'}, getMaxBars(700))).toBe('90m');
    expect(getEventGraphInterval({period: '7d'}, getMaxBars(1200))).toBe('1h');
  });

  it('picks the smallest interval that fits', () => {
    // 24 hourly bars fit in exactly 24 slots
    expect(getEventGraphInterval({period: '24h'}, 24)).toBe('1h');
    expect(getEventGraphInterval({period: '24h'}, 23)).toBe('90m');
  });

  it('uses absolute date ranges', () => {
    expect(
      getEventGraphInterval(
        {start: '2026-01-01T00:00:00', end: '2026-01-31T00:00:00'},
        getMaxBars(700)
      )
    ).toBe('8h');
  });

  it('does not go below one minute', () => {
    expect(getEventGraphInterval({period: '1h'}, getMaxBars(2000))).toBe('1m');
  });

  it('caps very long periods in narrow charts at one week', () => {
    expect(getEventGraphInterval({period: '90d'}, 5)).toBe('7d');
  });

  it('uses a default bar budget without a measured width', () => {
    expect(getEventGraphInterval({period: '14d'}, 0)).toBe('4h');
  });
});
