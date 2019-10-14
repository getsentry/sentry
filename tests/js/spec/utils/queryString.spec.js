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
});
