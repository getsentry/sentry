import utils from 'app/utils/queryString';

describe('addQueryParamsToExistingUrl', function() {
  it('adds new query params to existing query params', function() {
    const url = 'https://example.com?value=3';
    const newParams = {
      id: 4,
    };
    expect(utils.addQueryParamsToExistingUrl(url, newParams)).toBe(
      'https://example.com/?id=4&value=3'
    );
  });

  it('adds new query params without existing query params', function() {
    const url = 'https://example.com';
    const newParams = {
      id: 4,
    };
    expect(utils.addQueryParamsToExistingUrl(url, newParams)).toBe(
      'https://example.com/?id=4'
    );
  });

  it('returns empty string no url is passed', function() {
    let url;
    const newParams = {
      id: 4,
    };
    expect(utils.addQueryParamsToExistingUrl(url, newParams)).toBe('');
  });
});

describe('appendTagCondition', function() {
  it('adds simple values', function() {
    const result = utils.appendTagCondition('error+text', 'color', 'red');
    expect(result).toEqual('error+text color:red');
  });

  it('handles array current value', function() {
    const result = utils.appendTagCondition(['', 'thing'], 'color', 'red');
    expect(result).toEqual('thing color:red');
  });

  it('handles empty string current value', function() {
    const result = utils.appendTagCondition('', 'color', 'red');
    expect(result).toEqual('color:red');
  });

  it('handles null current value', function() {
    const result = utils.appendTagCondition(null, 'color', 'red');
    expect(result).toEqual('color:red');
  });

  it('wraps values with spaces', function() {
    const result = utils.appendTagCondition(null, 'color', 'purple red');
    expect(result).toEqual('color:"purple red"');
  });

  it('wraps values with colon', function() {
    const result = utils.appendTagCondition(null, 'color', 'id:red');
    expect(result).toEqual('color:"id:red"');
  });

  it('handles user tag values', function() {
    let result = utils.appendTagCondition('', 'user', 'something');
    expect(result).toEqual('user:something');

    result = utils.appendTagCondition('', 'user', 'id:1');
    expect(result).toEqual('user:"id:1"');

    result = utils.appendTagCondition('', 'user', 'email:foo@example.com');
    expect(result).toEqual('user:"email:foo@example.com"');

    result = utils.appendTagCondition('', 'user', 'name:jill jones');
    expect(result).toEqual('user:"name:jill jones"');
  });
});

describe('decodeScalar()', function() {
  it('unwraps array values', function() {
    expect(utils.decodeScalar(['one', 'two'])).toEqual('one');
  });

  it('handles strings', function() {
    expect(utils.decodeScalar('one')).toEqual('one');
  });

  it('handles falsey values', function() {
    expect(utils.decodeScalar(undefined)).toBeUndefined();
    expect(utils.decodeScalar(false)).toBeUndefined();
    expect(utils.decodeScalar('')).toBeUndefined();
  });
});

describe('decodeList()', function() {
  it('wraps string values', function() {
    expect(utils.decodeList('one')).toEqual(['one']);
  });

  it('handles arrays', function() {
    expect(utils.decodeList(['one', 'two'])).toEqual(['one', 'two']);
  });

  it('handles falsey values', function() {
    expect(utils.decodeList(undefined)).toBeUndefined();
    expect(utils.decodeList(false)).toBeUndefined();
    expect(utils.decodeList('')).toBeUndefined();
  });
});
