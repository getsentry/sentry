import {barColors, pickBarColour} from 'app/components/performance/waterfall/utils';
import CHART_PALETTE from 'app/constants/chartPalette';

describe('pickBarColour()', function () {
  it('returns blue when undefined', function () {
    expect(pickBarColour(undefined)).toEqual(barColors.default);
  });

  it('returns the predefined color when available', function () {
    expect(pickBarColour('transaction')).toEqual(barColors.transaction);
  });

  it('returns blue when the string is too short', function () {
    expect(pickBarColour('')).toEqual(barColors.default);
    expect(pickBarColour('c')).toEqual(barColors.default);
  });

  it('returns a random color when no predefined option is available', function () {
    const colorsAsArray = Object.keys(CHART_PALETTE).map(key => CHART_PALETTE[17][key]);

    let randomColor = pickBarColour('a normal string');
    expect(colorsAsArray).toContain(randomColor);

    randomColor = pickBarColour('this is a rather long string, it is longer than most');
    expect(colorsAsArray).toContain(randomColor);

    randomColor = pickBarColour('.periods.period');
    expect(colorsAsArray).toContain(randomColor);

    randomColor = pickBarColour('!!!!!!!!!!!');
    expect(colorsAsArray).toContain(randomColor);

    randomColor = pickBarColour('           ');
    expect(colorsAsArray).toContain(randomColor);
  });
});
