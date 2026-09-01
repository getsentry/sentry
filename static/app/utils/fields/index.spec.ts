import {getAttributeValue} from 'sentry/utils/fields';

describe('getAttributeValue', () => {
  it('returns the first value in the requested attribute deprecation chain', () => {
    expect(
      getAttributeValue(
        {
          'http.request.method': 'GET',
          'http.method': 'POST',
        },
        'http.method'
      )
    ).toBe('GET');
  });

  it('uses the chain associated with the requested search attribute', () => {
    expect(
      getAttributeValue(
        {
          'code.function': 'legacyFunction',
          'code.function.name': 'currentFunction',
        },
        'code.function.name'
      )
    ).toBe('currentFunction');
  });

  it('falls back to a deprecated attribute', () => {
    expect(getAttributeValue({method: 'POST'}, 'http.request.method')).toBe('POST');
  });

  it('returns a falsy value when its key is present', () => {
    expect(
      getAttributeValue(
        {
          'http.request.method': undefined,
          method: 'POST',
        },
        'http.request.method'
      )
    ).toBeUndefined();
  });

  it.each([
    [{value: 'test'}, 'unknown.attribute'],
    [{value: 'test'}, 'http.request.method'],
    [null, 'http.request.method'],
    ['not an object', 'http.request.method'],
  ])('returns undefined when no value can be found', (attributes, key) => {
    expect(getAttributeValue(attributes, key)).toBeUndefined();
  });
});
