import {parseFilterValueSize} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/size/parser';

describe('parseFilterValueSize', () => {
  it('parses size values', () => {
    expect(parseFilterValueSize('10')).toEqual({value: '10', unit: null});
    expect(parseFilterValueSize('10mb')).toEqual({value: '10', unit: 'mb'});
  });

  it('rejects non-size units', () => {
    expect(parseFilterValueSize('10ms')).toBeNull();
  });
});
