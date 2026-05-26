import {parseFilterValuePercentage} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/percentage/parser';

describe('parseFilterValuePercentage', () => {
  it('parses percentage values', () => {
    expect(parseFilterValuePercentage('0.25')).toEqual({value: '0.25', unit: null});
    expect(parseFilterValuePercentage('25%')).toEqual({value: '25', unit: '%'});
  });

  it('rejects non-percentage units', () => {
    expect(parseFilterValuePercentage('25ms')).toBeNull();
  });
});
