import {parseFilterValueDuration} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/duration/parser';

describe('parseFilterValueDuration', () => {
  it('parses duration values', () => {
    expect(parseFilterValueDuration('250')).toEqual({value: '250', unit: null});
    expect(parseFilterValueDuration('250ms')).toEqual({value: '250', unit: 'ms'});
  });

  it('rejects non-duration units', () => {
    expect(parseFilterValueDuration('250kb')).toBeNull();
  });
});
