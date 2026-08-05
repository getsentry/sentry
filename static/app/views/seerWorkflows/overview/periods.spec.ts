import {
  DEFAULT_STATS_PERIOD,
  PERIOD_FILTER_OPTIONS,
  periodWindowLabel,
} from 'sentry/views/seerWorkflows/overview/periods';

describe('periodWindowLabel', () => {
  it('returns the window phrase for a known period', () => {
    expect(periodWindowLabel('24h')).toBe('in the last 24 hours');
    expect(periodWindowLabel('7d')).toBe('in the last 7 days');
  });

  it('falls back to the default window phrase for an unknown period', () => {
    const defaultOption = PERIOD_FILTER_OPTIONS.find(
      option => option.value === DEFAULT_STATS_PERIOD
    );
    expect(periodWindowLabel('not-a-period')).toBe(defaultOption?.windowLabel);
  });
});

describe('PERIOD_FILTER_OPTIONS', () => {
  it('includes the default stats period', () => {
    expect(
      PERIOD_FILTER_OPTIONS.some(option => option.value === DEFAULT_STATS_PERIOD)
    ).toBe(true);
  });
});
