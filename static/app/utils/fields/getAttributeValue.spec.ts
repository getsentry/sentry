import {getAttributeValue} from 'sentry/utils/fields/getAttributeValue';

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

  it('returns values from attribute entry arrays', () => {
    expect(
      getAttributeValue(
        [{name: 'span.category', type: 'str', value: 'http'}],
        'span.category',
        'string'
      )
    ).toBe('http');
    expect(
      getAttributeValue(
        [{name: 'tags[http.method,string]', type: 'str', value: 'GET'}],
        'http.request.method',
        'string'
      )
    ).toBe('GET');
  });

  it('prettifies an explicit typed tag lookup key', () => {
    expect(
      getAttributeValue({'http.request.method': 'GET'}, 'tags[http.method,string]')
    ).toBe('GET');
  });

  it('prettifies explicit typed tag keys in attribute records', () => {
    expect(
      getAttributeValue(
        {'tags[http.status_code,number]': 200},
        'http.response.status_code',
        'number'
      )
    ).toBe(200);
  });

  it('preserves prefixes when matching explicit typed tag keys', () => {
    expect(
      getAttributeValue(
        [
          {name: 'tags[severity,string]', value: 'unprefixed'},
          {name: 'tags[log.severity,string]', value: 'prefixed'},
        ],
        'log.severity',
        'string'
      )
    ).toBe('prefixed');
    expect(
      getAttributeValue(
        {
          'tags[severity,string]': 'unprefixed',
          'tags[log.severity,string]': 'prefixed',
        },
        'log.severity',
        'string'
      )
    ).toBe('prefixed');
  });

  it.each([['GET'], [200], [false], [['GET', 'POST']], [[200, 201]], [[true, false]]])(
    'returns a supported attribute value: %p',
    value => {
      expect(
        getAttributeValue({'http.request.method': value}, 'http.request.method')
      ).toEqual(value);
    }
  );

  it('returns only values matching the requested kind', () => {
    const stringValue = getAttributeValue(
      {'http.request.method': 'GET'},
      'http.request.method',
      'string'
    );
    const numberValue = getAttributeValue(
      {'http.request.method': 200},
      'http.request.method',
      'number'
    );
    const booleanValue = getAttributeValue(
      {'http.request.method': false},
      'http.request.method',
      'boolean'
    );
    const stringArrayValue = getAttributeValue(
      {'http.request.method': ['GET', 'POST']},
      'http.request.method',
      'string[]'
    );
    const numberArrayValue = getAttributeValue(
      {'http.request.method': [200, 201]},
      'http.request.method',
      'number[]'
    );
    const booleanArrayValue = getAttributeValue(
      {'http.request.method': [true, false]},
      'http.request.method',
      'boolean[]'
    );

    expect(stringValue).toBe('GET');
    expect(numberValue).toBe(200);
    expect(booleanValue).toBe(false);
    expect(stringArrayValue).toEqual(['GET', 'POST']);
    expect(numberArrayValue).toEqual([200, 201]);
    expect(booleanArrayValue).toEqual([true, false]);
    expect(
      getAttributeValue({'http.request.method': 200}, 'http.request.method', 'string')
    ).toBeUndefined();
  });

  it('returns numeric attributes without losing integer precision', () => {
    expect(getAttributeValue({'code.lineno': '42'}, 'code.lineno', 'number')).toBe(42);
    expect(getAttributeValue({'code.lineno': '42.5'}, 'code.lineno', 'number')).toBe(
      42.5
    );
    expect(
      getAttributeValue({'code.lineno': '9007199254740993'}, 'code.lineno', 'number')
    ).toBe(9007199254740993n);
    expect(
      getAttributeValue({'code.lineno': 9007199254740993n}, 'code.lineno', 'number')
    ).toBe(9007199254740993n);
    expect(
      getAttributeValue({'code.lineno': 'not a number'}, 'code.lineno', 'number')
    ).toBeUndefined();
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

  it('falls back to the requested key after a cached metadata miss', () => {
    expect(getAttributeValue({value: 'test'}, 'unknown.attribute')).toBeUndefined();
    expect(getAttributeValue({value: 'test'}, 'unknown.attribute')).toBeUndefined();
    expect(
      getAttributeValue({'unknown.attribute': 'test'}, 'unknown.attribute', 'string')
    ).toBe('test');
  });

  it.each([
    [{value: 'test'}, 'http.request.method'],
    [{'http.request.method': {method: 'GET'}}, 'http.request.method'],
    [{'http.request.method': ['GET', 200]}, 'http.request.method'],
  ])('returns undefined when no value can be found', (attributes, key) => {
    expect(getAttributeValue(attributes, key)).toBeUndefined();
  });
});
