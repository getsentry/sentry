import {ThemeFixture} from 'sentry-fixture/theme';

import {makeBarColors, pickBarColor} from 'sentry/components/performance/waterfall/utils';

const theme = ThemeFixture();

describe('pickBarColor()', function () {
  it('returns blue when undefined', function () {
    expect(pickBarColor(undefined, theme)).toEqual(makeBarColors(theme).default);
  });

  it('returns the predefined color when available', function () {
    expect(pickBarColor('transaction', theme)).toEqual(makeBarColors(theme).transaction);
  });

  it('returns blue when the string is too short', function () {
    expect(pickBarColor('', theme)).toEqual(makeBarColors(theme).default);
    expect(pickBarColor('c', theme)).toEqual(makeBarColors(theme).default);
  });

  it('returns a random color when no predefined option is available', function () {
    const colorsAsArray = Object.keys(theme.chart.colors).map(
      key => theme.chart.colors[17][key as keyof typeof theme.chart.colors]
    );

    let randomColor = pickBarColor('a normal string', theme);
    expect(colorsAsArray).toContain(randomColor);

    randomColor = pickBarColor(
      'this is a rather long string, it is longer than most',
      theme
    );
    expect(colorsAsArray).toContain(randomColor);

    randomColor = pickBarColor('.periods.period', theme);
    expect(colorsAsArray).toContain(randomColor);

    randomColor = pickBarColor('!!!!!!!!!!!', theme);
    expect(colorsAsArray).toContain(randomColor);

    randomColor = pickBarColor('           ', theme);
    expect(colorsAsArray).toContain(randomColor);
  });
});
