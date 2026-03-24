import {ThemeFixture} from 'sentry-fixture/theme';

import {pickBarColor} from 'sentry/components/performance/waterfall/utils';

const theme = ThemeFixture();

describe('pickBarColor()', () => {
  it('returns magenta when undefined', () => {
    expect(pickBarColor(undefined, theme)).toBe('#B82D90');
  });

  it('returns the predefined color when available', () => {
    expect(pickBarColor('transaction', theme)).toBe('#FFD00E');
  });

  it('returns magenta when the string is too short', () => {
    expect(pickBarColor('', theme)).toBe('#B82D90');
    expect(pickBarColor('c', theme)).toBe('#B82D90');
  });

  it('returns a random color when no predefined option is available', () => {
    const palette = theme.chart.getColorPalette(17);
    const colorsAsArray = Object.keys(palette).map(
      key => palette[key as keyof typeof palette]
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
