import {barColors, pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {lightTheme} from 'sentry/utils/theme';

describe('pickBarColor()', function () {
  it('returns blue when undefined', function () {
    expect(pickBarColor(undefined)).toEqual(barColors.default);
  });

  it('returns the predefined color when available', function () {
    expect(pickBarColor('transaction')).toEqual(barColors.transaction);
  });

  it('returns blue when the string is too short', function () {
    expect(pickBarColor('')).toEqual(barColors.default);
    expect(pickBarColor('c')).toEqual(barColors.default);
  });

  it('returns a random color when no predefined option is available', function () {
    const colorsAsArray = Object.keys(lightTheme.chart.colors).map(
      key => lightTheme.chart.colors[17][key as keyof typeof lightTheme.chart.colors]
    );

    let randomColor = pickBarColor('a normal string');
    expect(colorsAsArray).toContain(randomColor);

    randomColor = pickBarColor('this is a rather long string, it is longer than most');
    expect(colorsAsArray).toContain(randomColor);

    randomColor = pickBarColor('.periods.period');
    expect(colorsAsArray).toContain(randomColor);

    randomColor = pickBarColor('!!!!!!!!!!!');
    expect(colorsAsArray).toContain(randomColor);

    randomColor = pickBarColor('           ');
    expect(colorsAsArray).toContain(randomColor);
  });
});
