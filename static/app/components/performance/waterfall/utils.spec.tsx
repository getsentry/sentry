import {makeBarColors, pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {lightTheme} from 'sentry/utils/theme';

describe('pickBarColor()', function () {
  it('returns blue when undefined', function () {
    expect(pickBarColor(undefined, lightTheme)).toEqual(
      makeBarColors(lightTheme).default
    );
  });

  it('returns the predefined color when available', function () {
    expect(pickBarColor('transaction', lightTheme)).toEqual(
      makeBarColors(lightTheme).transaction
    );
  });

  it('returns blue when the string is too short', function () {
    expect(pickBarColor('', lightTheme)).toEqual(makeBarColors(lightTheme).default);
    expect(pickBarColor('c', lightTheme)).toEqual(makeBarColors(lightTheme).default);
  });

  it('returns a random color when no predefined option is available', function () {
    const colorsAsArray = Object.keys(lightTheme.chart.colors).map(
      key => lightTheme.chart.colors[17][key as keyof typeof lightTheme.chart.colors]
    );

    let randomColor = pickBarColor('a normal string', lightTheme);
    expect(colorsAsArray).toContain(randomColor);

    randomColor = pickBarColor(
      'this is a rather long string, it is longer than most',
      lightTheme
    );
    expect(colorsAsArray).toContain(randomColor);

    randomColor = pickBarColor('.periods.period', lightTheme);
    expect(colorsAsArray).toContain(randomColor);

    randomColor = pickBarColor('!!!!!!!!!!!', lightTheme);
    expect(colorsAsArray).toContain(randomColor);

    randomColor = pickBarColor('           ', lightTheme);
    expect(colorsAsArray).toContain(randomColor);
  });
});
