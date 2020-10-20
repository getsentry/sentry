import CHART_PALETTE from 'app/constants/chartPalette';
import {
  spanColors,
  pickSpanBarColour,
} from 'app/components/events/interfaces/spans/utils';

describe('pickSpanBarColour()', function () {
  it('returns blue when undefined', function () {
    expect(pickSpanBarColour(undefined)).toEqual(spanColors.default);
  });

  it('returns the predefined color when available', function () {
    expect(pickSpanBarColour('transaction')).toEqual(spanColors.transaction);
  });

  it('returns blue when the string is too short', function () {
    expect(pickSpanBarColour('')).toEqual(spanColors.default);
    expect(pickSpanBarColour('c')).toEqual(spanColors.default);
  });

  it('returns a random color when no predefined option is available', function () {
    const colorsAsArray = Object.keys(CHART_PALETTE).map(key => CHART_PALETTE[17][key]);

    let randomColor = pickSpanBarColour('a normal string');
    expect(colorsAsArray).toContain(randomColor);

    randomColor = pickSpanBarColour(
      'this is a rather long string, it is longer than most'
    );
    expect(colorsAsArray).toContain(randomColor);

    randomColor = pickSpanBarColour('.periods.period');
    expect(colorsAsArray).toContain(randomColor);

    randomColor = pickSpanBarColour('!!!!!!!!!!!');
    expect(colorsAsArray).toContain(randomColor);

    randomColor = pickSpanBarColour('           ');
    expect(colorsAsArray).toContain(randomColor);
  });
});
