import utils from 'app/utils/queryString';

describe('getQueryEnvironment()', function() {
  it('returns environment name', function() {
    const qs = 'is:unresolved is:unassigned environment:production';
    expect(utils.getQueryEnvironment(qs)).toBe('production');
  });

  // empty environment aka. (No environment) has '' as a name
  it('returns empty string environment (the empty environment case)', function() {
    const qs = 'is:unresolved is:unassigned environment:';
    expect(utils.getQueryEnvironment(qs)).toBe('');
  });

  it('returns null if no environment specified in query', function() {
    const qs = 'is:unresolved is:unassigned';
    expect(utils.getQueryEnvironment(qs)).toBe(null);
  });

  it('handles environment with non word characters', function() {
    const qs = 'is:unresolved is:unassigned environment:something.com';
    expect(utils.getQueryEnvironment(qs)).toBe('something.com');
  });

  it('handles environment provided with quote marks', function() {
    const qs = 'is:unresolved is:unassigned environment:"production"';
    expect(utils.getQueryEnvironment(qs)).toBe('production');
  });

  it('handles environment names with space and quote marks', function() {
    const qs = 'is:unresolved is:unassigned environment:"my environment"';
    expect(utils.getQueryEnvironment(qs)).toBe('my environment');
  });

  it('handles query property similar to `environment`', function() {
    const qs = 'test_environment:development';
    expect(utils.getQueryEnvironment(qs)).toBe(null);
  });
});

describe('getQueryStringWithEnvironment', function() {
  it('replaces environment in query string', function() {
    const qs = 'is:unresolved environment:development is:unassigned';
    expect(utils.getQueryStringWithEnvironment(qs, 'staging')).toBe(
      'is:unresolved is:unassigned environment:staging'
    );
  });

  it('handles empty string environment', function() {
    const qs = 'is:unresolved environment:development is:unassigned';
    expect(utils.getQueryStringWithEnvironment(qs, '')).toBe(
      'is:unresolved is:unassigned environment:'
    );
  });

  it('handles null environment', function() {
    const qs = 'is:unresolved environment:development is:unassigned';
    expect(utils.getQueryStringWithEnvironment(qs, null)).toBe(
      'is:unresolved is:unassigned'
    );
  });

  it('handles environment with non word characters', function() {
    const qs = 'is:unresolved environment:something.com is:unassigned';
    expect(utils.getQueryStringWithEnvironment(qs, 'test.com')).toBe(
      'is:unresolved is:unassigned environment:test.com'
    );
  });

  it('handles query property similar to `environment`', function() {
    const qs = 'test_environment:development';
    expect(utils.getQueryStringWithEnvironment(qs, 'test.com')).toBe(
      'test_environment:development environment:test.com'
    );
  });
});

describe('getQueryStringWithoutEnvironment', function() {
  it('removes environment from querystring', function() {
    const qs = 'is:unresolved environment:development is:unassigned';
    expect(utils.getQueryStringWithoutEnvironment(qs)).toBe(
      'is:unresolved is:unassigned'
    );
  });

  it('removes empty environment from querystring', function() {
    const qs = 'is:unresolved environment: is:unassigned';
    expect(utils.getQueryStringWithoutEnvironment(qs)).toBe(
      'is:unresolved is:unassigned'
    );
  });

  it('handles query property similar to `environment`', function() {
    const qs = 'test_environment:development';
    expect(utils.getQueryStringWithoutEnvironment(qs)).toBe(
      'test_environment:development'
    );
  });
});

describe('addQueryParamsToExistingUrl', function() {
  it('adds new query params to existing query params', function() {
    const url = 'https://example.com?value=3';
    const newParams = {id: 4};
    expect(utils.addQueryParamsToExistingUrl(url, newParams)).toBe(
      'https://example.com/?id=4&value=3'
    );
  });

  it('adds new query params without existing query params', function() {
    const url = 'https://example.com';
    const newParams = {id: 4};
    expect(utils.addQueryParamsToExistingUrl(url, newParams)).toBe(
      'https://example.com/?id=4'
    );
  });

  it('returns empty string no url is passed', function() {
    let url;
    const newParams = {id: 4};
    expect(utils.addQueryParamsToExistingUrl(url, newParams)).toBe('');
  });
});
