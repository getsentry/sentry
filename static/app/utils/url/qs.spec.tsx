import {parse, stringify, stringifyUrl} from './qs';

describe('stringify', () => {
  it('sorts keys, repeats array keys and writes null as a bare key', () => {
    expect(
      stringify({z: '1', a: ['x', 'y'], flag: null, absent: undefined, empty: '', n: 0})
    ).toBe('a=x&a=y&empty=&flag&n=0&z=1');
  });

  it('skips null values and array items with skipNull', () => {
    expect(stringify({a: ['x', null], flag: null, b: 'y'}, {skipNull: true})).toBe(
      'a=x&b=y'
    );
  });

  it('percent-encodes spaces and the characters encodeURIComponent keeps', () => {
    expect(stringify({'k y': "it's (a) test!*", q: 'is:unresolved&x=1'})).toBe(
      'k%20y=it%27s%20%28a%29%20test%21%2A&q=is%3Aunresolved%26x%3D1'
    );
  });

  it('writes dates as ISO strings and never throws on objects', () => {
    expect(
      stringify({start: new Date('2024-01-15T10:30:00Z'), invalid: new Date(''), obj: {}})
    ).toBe(
      'invalid=Invalid%20Date&obj=%5Bobject%20Object%5D&start=2024-01-15T10%3A30%3A00.000Z'
    );
  });

  it('returns an empty string for empty input', () => {
    expect(stringify(undefined)).toBe('');
    expect(stringify({a: [], b: undefined})).toBe('');
  });
});

describe('parse', () => {
  it('parses repeated keys, bare keys and plus signs', () => {
    expect(parse('?b=1&a=x&a=y&flag&s=a+b%20c&e=')).toEqual({
      a: ['x', 'y'],
      b: '1',
      e: '',
      flag: null,
      s: 'a b c',
    });
  });

  it('returns sorted keys without a prototype', () => {
    const query = parse('b=1&a=2&__proto__=3');
    expect(Object.keys(query)).toEqual(['__proto__', 'a', 'b']);
    expect(Object.getPrototypeOf(query)).toBeNull();
  });

  it('keeps malformed percent sequences as typed', () => {
    expect(parse('q=100%&r=%E0%A4%A&s=%E2%82%AC%ZZ')).toEqual({
      q: '100%',
      r: '%E0%A4%A',
      s: '€%ZZ',
    });
  });

  it('only splits a parameter on its first equals sign', () => {
    expect(parse('query=a=b&&x=%3D')).toEqual({query: 'a=b', x: '='});
  });
});

describe('stringifyUrl', () => {
  it('merges the query into the URL and keeps the hash', () => {
    expect(
      stringifyUrl({
        url: 'https://example.com/issues/?b=2&a=1#details',
        query: {c: '3', a: undefined},
      })
    ).toBe('https://example.com/issues/?b=2&c=3#details');
  });

  it('leaves out the question mark when there is no query', () => {
    expect(stringifyUrl({url: '/issues/?', query: {}})).toBe('/issues/');
  });

  it('passes skipNull through', () => {
    expect(
      stringifyUrl({url: '/issues/', query: {a: null, b: '1'}}, {skipNull: true})
    ).toBe('/issues/?b=1');
  });
});
