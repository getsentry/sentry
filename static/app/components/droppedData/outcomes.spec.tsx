import {ThemeFixture} from 'sentry-fixture/theme';

import {getOutcomeColors, reasonTitle} from './outcomes';

describe('getOutcomeColors', () => {
  it('assigns the same colors regardless of input order', () => {
    const theme = ThemeFixture();

    expect(
      getOutcomeColors(['rate_limited', 'client_discard', 'invalid'], theme)
    ).toEqual(getOutcomeColors(['invalid', 'rate_limited', 'client_discard'], theme));
  });

  it('gives each outcome a distinct color', () => {
    const colors = getOutcomeColors(
      ['client_discard', 'filtered', 'invalid', 'client_discard'],
      ThemeFixture()
    );

    expect(Object.keys(colors).sort()).toEqual(['client_discard', 'filtered', 'invalid']);
    expect(new Set(Object.values(colors)).size).toBe(3);
  });
});

describe('reasonTitle', () => {
  it('maps a known reason code to its human title', () => {
    expect(reasonTitle('sample_rate')).toBe('Dropped by sample rate');
    expect(reasonTitle('too_large:span')).toBe('Span payload too large');
  });

  it('maps category-prefixed quota reasons to the quota title', () => {
    expect(reasonTitle('span_usage_exceeded')).toBe('Quota exceeded');
    expect(reasonTitle('log_bytes_usage_exceeded')).toBe('Quota exceeded');
  });

  it('titles the localhost filter and invalid timestamp reasons', () => {
    expect(reasonTitle('localhost')).toBe('Localhost filter');
    expect(reasonTitle('timestamp')).toBe('Invalid timestamp');
  });

  it("maps the JavaScript SDK's ignored reason to the ignored spans title", () => {
    expect(reasonTitle('ignored')).toBe('Dropped by ignored spans');
  });

  it('titles the cors reason', () => {
    expect(reasonTitle('cors')).toBe('Disallowed origin');
  });

  it('maps dynamic-sampling reasons that carry a rule-id suffix', () => {
    expect(reasonTitle('Sampled:3000')).toBe('Dynamic sampling');
  });

  it('falls back to the raw code for an unknown reason', () => {
    expect(reasonTitle('some_new_reason')).toBe('some_new_reason');
  });
});
