import {
  addQueryParamsToExistingUrl,
  appendExcludeTagValuesCondition,
  appendTagCondition,
  decodeBoolean,
  decodeInteger,
  decodeList,
  decodeScalar,
  decodeSorts,
} from './queryString';

describe('addQueryParamsToExistingUrl', () => {
  it('adds new query params to existing query params', () => {
    const url = 'https://example.com?value=3';
    const newParams = {
      id: 4,
    };
    expect(addQueryParamsToExistingUrl(url, newParams)).toBe(
      'https://example.com/?id=4&value=3'
    );
  });

  it('adds new query params without existing query params', () => {
    const url = 'https://example.com';
    const newParams = {
      id: 4,
    };
    expect(addQueryParamsToExistingUrl(url, newParams)).toBe('https://example.com/?id=4');
  });

  it('returns empty string no url is passed', () => {
    let url: any;
    const newParams = {
      id: 4,
    };
    expect(addQueryParamsToExistingUrl(url, newParams)).toBe('');
  });
});

describe('appendTagCondition', () => {
  it('adds simple values', () => {
    const result = appendTagCondition('error+text', 'color', 'red');
    expect(result).toBe('error+text color:red');
  });

  it('handles array current value', () => {
    const result = appendTagCondition(['', 'thing'], 'color', 'red');
    expect(result).toBe('thing color:red');
  });

  it('handles empty string current value', () => {
    const result = appendTagCondition('', 'color', 'red');
    expect(result).toBe('color:red');
  });

  it('handles null current value', () => {
    const result = appendTagCondition(null, 'color', 'red');
    expect(result).toBe('color:red');
  });

  it('wraps values with spaces', () => {
    const result = appendTagCondition(null, 'color', 'purple red');
    expect(result).toBe('color:"purple red"');
  });

  it('wraps values with colon', () => {
    const result = appendTagCondition(null, 'color', 'id:red');
    expect(result).toBe('color:"id:red"');
  });

  it('wraps values with a backslash', () => {
    const result = appendTagCondition(null, 'color', 'id\\red');
    expect(result).toBe('color:"id\\red"');
  });

  it('handles user tag values', () => {
    let result = appendTagCondition('', 'user', 'something');
    expect(result).toBe('user:something');

    result = appendTagCondition('', 'user', 'id:1');
    expect(result).toBe('user:"id:1"');

    result = appendTagCondition('', 'user', 'email:foo@example.com');
    expect(result).toBe('user:"email:foo@example.com"');

    result = appendTagCondition('', 'user', 'name:jill jones');
    expect(result).toBe('user:"name:jill jones"');
  });
});

describe('appendExcludeTagValuesCondition', () => {
  it('excludes tag values', () => {
    const result = appendExcludeTagValuesCondition(null, 'color', [
      'red',
      'blue',
      'green',
    ]);
    expect(result).toBe('!color:[red, blue, green]');
  });
  it('excludes tag values on an existing query', () => {
    const result = appendExcludeTagValuesCondition('user.id:123', 'color', [
      'red',
      'blue',
      'green',
    ]);
    expect(result).toBe('user.id:123 !color:[red, blue, green]');
  });
  it('wraps double quotes when a space exists in the tag value', () => {
    const result = appendExcludeTagValuesCondition(null, 'color', [
      'red',
      'ocean blue',
      '"green"',
      '"sky blue"',
    ]);
    expect(result).toBe('!color:[red, "ocean blue", "\\"green\\"", "\\"sky blue\\""]');
  });
});

describe('decodeScalar()', () => {
  it('unwraps array values', () => {
    expect(decodeScalar(['one', 'two'])).toBe('one');
  });

  it('handles strings', () => {
    expect(decodeScalar('one')).toBe('one');
  });

  it('handles falsey values', () => {
    expect(decodeScalar(undefined)).toBeUndefined();
    // @ts-expect-error type false is not assignable to QueryValue
    expect(decodeScalar(false)).toBeUndefined();
    expect(decodeScalar('')).toBeUndefined();
  });

  it('uses fallback values', () => {
    expect(decodeScalar('value', 'default')).toBe('value');
    expect(decodeScalar('', 'default')).toBe('default');
    expect(decodeScalar(null, 'default')).toBe('default');
    expect(decodeScalar(undefined, 'default')).toBe('default');
    expect(decodeScalar([], 'default')).toBe('default');
  });
});

describe('decodeList()', () => {
  it('wraps string values', () => {
    expect(decodeList('one')).toEqual(['one']);
  });

  it('handles arrays', () => {
    expect(decodeList(['one', 'two'])).toEqual(['one', 'two']);
  });

  it('handles falsey values', () => {
    expect(decodeList(undefined)).toEqual([]);
    // @ts-expect-error type false is not assignable to QueryValue
    expect(decodeList(false)).toEqual([]);
    expect(decodeList('')).toEqual([]);
  });
});

describe('decodeInteger()', () => {
  it('handles integer strings', () => {
    expect(decodeInteger('1')).toBe(1);
    expect(decodeInteger('1.2')).toBe(1);
    expect(decodeInteger('1.9')).toBe(1);
    expect(decodeInteger('foo')).toBeUndefined();
    expect(decodeInteger('foo', 2020)).toBe(2020);
  });

  it('handles arrays', () => {
    expect(decodeInteger(['1', 'foo'])).toBe(1);
    expect(decodeInteger(['1.2', 'foo'])).toBe(1);
    expect(decodeInteger(['1.9', 'foo'])).toBe(1);
    expect(decodeInteger(['foo', '1'])).toBeUndefined();
    expect(decodeInteger(['foo'], 2020)).toBe(2020);
  });

  it('handles falsey values', () => {
    expect(decodeInteger(undefined, 2020)).toBe(2020);
    // @ts-expect-error type false is not assignable to QueryValue
    expect(decodeInteger(false, 2020)).toBe(2020);
    expect(decodeInteger('', 2020)).toBe(2020);
  });
});

describe('decodeSorts', () => {
  it('handles simple strings and lists', () => {
    expect(decodeSorts('startedAt')).toEqual([{kind: 'asc', field: 'startedAt'}]);
    expect(decodeSorts(['startedAt', 'finishedAt'])).toEqual([
      {kind: 'asc', field: 'startedAt'},
      {kind: 'asc', field: 'finishedAt'},
    ]);
    expect(decodeSorts('-startedAt')).toEqual([{kind: 'desc', field: 'startedAt'}]);
    expect(decodeSorts(['-startedAt', '-finishedAt'])).toEqual([
      {kind: 'desc', field: 'startedAt'},
      {kind: 'desc', field: 'finishedAt'},
    ]);
  });

  it('handles falsey values', () => {
    expect(decodeSorts(null)).toEqual([]);
    expect(decodeSorts(undefined)).toEqual([]);
    expect(decodeSorts('')).toEqual([]);
    expect(decodeSorts([''])).toEqual([]);
  });

  it('fallsback to a default value', () => {
    expect(decodeSorts(null, '-startedAt')).toEqual([{kind: 'desc', field: 'startedAt'}]);
    expect(decodeSorts(undefined, '-startedAt')).toEqual([
      {kind: 'desc', field: 'startedAt'},
    ]);
    expect(decodeSorts('', '-startedAt')).toEqual([{kind: 'desc', field: 'startedAt'}]);
    expect(decodeSorts([''], '-startedAt')).toEqual([{kind: 'desc', field: 'startedAt'}]);
  });
});

describe('decodeBoolean', () => {
  it('handles boolean strings', () => {
    expect(decodeBoolean('true')).toBe(true);
    expect(decodeBoolean('false')).toBe(false);
    expect(decodeBoolean('foo')).toBeUndefined();
    expect(decodeBoolean('foo', true)).toBe(true);
    expect(decodeBoolean('foo', false)).toBe(false);
  });
});
