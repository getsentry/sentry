import utils from 'sentry/utils/queryString';

describe('addQueryParamsToExistingUrl', function () {
  it('adds new query params to existing query params', function () {
    const url = 'https://example.com?value=3';
    const newParams = {
      id: 4,
    };
    expect(utils.addQueryParamsToExistingUrl(url, newParams)).toBe(
      'https://example.com/?id=4&value=3'
    );
  });

  it('adds new query params without existing query params', function () {
    const url = 'https://example.com';
    const newParams = {
      id: 4,
    };
    expect(utils.addQueryParamsToExistingUrl(url, newParams)).toBe(
      'https://example.com/?id=4'
    );
  });

  it('returns empty string no url is passed', function () {
    let url: any;
    const newParams = {
      id: 4,
    };
    expect(utils.addQueryParamsToExistingUrl(url, newParams)).toBe('');
  });
});

describe('appendTagCondition', function () {
  it('adds simple values', function () {
    const result = utils.appendTagCondition('error+text', 'color', 'red');
    expect(result).toBe('error+text color:red');
  });

  it('handles array current value', function () {
    const result = utils.appendTagCondition(['', 'thing'], 'color', 'red');
    expect(result).toBe('thing color:red');
  });

  it('handles empty string current value', function () {
    const result = utils.appendTagCondition('', 'color', 'red');
    expect(result).toBe('color:red');
  });

  it('handles null current value', function () {
    const result = utils.appendTagCondition(null, 'color', 'red');
    expect(result).toBe('color:red');
  });

  it('wraps values with spaces', function () {
    const result = utils.appendTagCondition(null, 'color', 'purple red');
    expect(result).toBe('color:"purple red"');
  });

  it('wraps values with colon', function () {
    const result = utils.appendTagCondition(null, 'color', 'id:red');
    expect(result).toBe('color:"id:red"');
  });

  it('handles user tag values', function () {
    let result = utils.appendTagCondition('', 'user', 'something');
    expect(result).toBe('user:something');

    result = utils.appendTagCondition('', 'user', 'id:1');
    expect(result).toBe('user:"id:1"');

    result = utils.appendTagCondition('', 'user', 'email:foo@example.com');
    expect(result).toBe('user:"email:foo@example.com"');

    result = utils.appendTagCondition('', 'user', 'name:jill jones');
    expect(result).toBe('user:"name:jill jones"');
  });
});

describe('appendExcludeTagValuesCondition', function () {
  it('excludes tag values', function () {
    const result = utils.appendExcludeTagValuesCondition(null, 'color', [
      'red',
      'blue',
      'green',
    ]);
    expect(result).toBe('!color:[red, blue, green]');
  });
  it('excludes tag values on an existing query', function () {
    const result = utils.appendExcludeTagValuesCondition('user.id:123', 'color', [
      'red',
      'blue',
      'green',
    ]);
    expect(result).toBe('user.id:123 !color:[red, blue, green]');
  });
  it('wraps double quotes when a space exists in the tag value', function () {
    const result = utils.appendExcludeTagValuesCondition(null, 'color', [
      'red',
      'ocean blue',
      '"green"',
      '"sky blue"',
    ]);
    expect(result).toBe('!color:[red, "ocean blue", "\\"green\\"", "\\"sky blue\\""]');
  });
});

describe('decodeScalar()', function () {
  it('unwraps array values', function () {
    expect(utils.decodeScalar(['one', 'two'])).toBe('one');
  });

  it('handles strings', function () {
    expect(utils.decodeScalar('one')).toBe('one');
  });

  it('handles falsey values', function () {
    expect(utils.decodeScalar(undefined)).toBeUndefined();
    // @ts-expect-error type false is not assignable to QueryValue
    expect(utils.decodeScalar(false)).toBeUndefined();
    expect(utils.decodeScalar('')).toBeUndefined();
  });

  it('uses fallback values', function () {
    expect(utils.decodeScalar('value', 'default')).toBe('value');
    expect(utils.decodeScalar('', 'default')).toBe('default');
    expect(utils.decodeScalar(null, 'default')).toBe('default');
    expect(utils.decodeScalar(undefined, 'default')).toBe('default');
    expect(utils.decodeScalar([], 'default')).toBe('default');
  });
});

describe('decodeList()', function () {
  it('wraps string values', function () {
    expect(utils.decodeList('one')).toEqual(['one']);
  });

  it('handles arrays', function () {
    expect(utils.decodeList(['one', 'two'])).toEqual(['one', 'two']);
  });

  it('handles falsey values', function () {
    expect(utils.decodeList(undefined)).toEqual([]);
    // @ts-expect-error type false is not assignable to QueryValue
    expect(utils.decodeList(false)).toEqual([]);
    expect(utils.decodeList('')).toEqual([]);
  });
});

describe('decodeInteger()', function () {
  it('handles integer strings', function () {
    expect(utils.decodeInteger('1')).toBe(1);
    expect(utils.decodeInteger('1.2')).toBe(1);
    expect(utils.decodeInteger('1.9')).toBe(1);
    expect(utils.decodeInteger('foo')).toBeUndefined();
    expect(utils.decodeInteger('foo', 2020)).toBe(2020);
  });

  it('handles arrays', function () {
    expect(utils.decodeInteger(['1', 'foo'])).toBe(1);
    expect(utils.decodeInteger(['1.2', 'foo'])).toBe(1);
    expect(utils.decodeInteger(['1.9', 'foo'])).toBe(1);
    expect(utils.decodeInteger(['foo', '1'])).toBeUndefined();
    expect(utils.decodeInteger(['foo'], 2020)).toBe(2020);
  });

  it('handles falsey values', function () {
    expect(utils.decodeInteger(undefined, 2020)).toBe(2020);
    // @ts-expect-error type false is not assignable to QueryValue
    expect(utils.decodeInteger(false, 2020)).toBe(2020);
    expect(utils.decodeInteger('', 2020)).toBe(2020);
  });
});

describe('decodeSorts', () => {
  it('handles simple strings and lists', () => {
    expect(utils.decodeSorts('startedAt')).toEqual([{kind: 'asc', field: 'startedAt'}]);
    expect(utils.decodeSorts(['startedAt', 'finishedAt'])).toEqual([
      {kind: 'asc', field: 'startedAt'},
      {kind: 'asc', field: 'finishedAt'},
    ]);
    expect(utils.decodeSorts('-startedAt')).toEqual([{kind: 'desc', field: 'startedAt'}]);
    expect(utils.decodeSorts(['-startedAt', '-finishedAt'])).toEqual([
      {kind: 'desc', field: 'startedAt'},
      {kind: 'desc', field: 'finishedAt'},
    ]);
  });

  it('handles falsey values', () => {
    expect(utils.decodeSorts(null)).toEqual([]);
    expect(utils.decodeSorts(undefined)).toEqual([]);
    expect(utils.decodeSorts('')).toEqual([]);
    expect(utils.decodeSorts([''])).toEqual([]);
  });

  it('fallsback to a default value', () => {
    expect(utils.decodeSorts(null, '-startedAt')).toEqual([
      {kind: 'desc', field: 'startedAt'},
    ]);
    expect(utils.decodeSorts(undefined, '-startedAt')).toEqual([
      {kind: 'desc', field: 'startedAt'},
    ]);
    expect(utils.decodeSorts('', '-startedAt')).toEqual([
      {kind: 'desc', field: 'startedAt'},
    ]);
    expect(utils.decodeSorts([''], '-startedAt')).toEqual([
      {kind: 'desc', field: 'startedAt'},
    ]);
  });
});

describe('decodeBoolean', function () {
  it('handles boolean strings', function () {
    expect(utils.decodeBoolean('true')).toBe(true);
    expect(utils.decodeBoolean('false')).toBe(false);
    expect(utils.decodeBoolean('foo')).toBeUndefined();
    expect(utils.decodeBoolean('foo', true)).toBe(true);
    expect(utils.decodeBoolean('foo', false)).toBe(false);
  });
});
