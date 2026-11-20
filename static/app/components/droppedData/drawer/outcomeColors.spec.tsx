import {ThemeFixture} from 'sentry-fixture/theme';

import {getOutcomeColors} from './outcomeColors';

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
