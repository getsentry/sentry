import {barColors, pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';

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
    const colorsAsArray = Object.keys(CHART_PALETTE).map(key => CHART_PALETTE[17][key]);

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
