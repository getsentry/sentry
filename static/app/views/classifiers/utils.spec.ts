import {getEnvironmentsFilter} from './utils';

describe('getEnvironmentsFilter', () => {
  it('returns an empty filter without environments', () => {
    expect(getEnvironmentsFilter([])).toBe('');
  });

  it('quotes every environment', () => {
    expect(getEnvironmentsFilter(['production', 'staging'])).toBe(
      'environment:["production", "staging"]'
    );
  });

  it('escapes double quotes', () => {
    expect(getEnvironmentsFilter(['a"b'])).toBe('environment:["a\\"b"]');
  });
});
