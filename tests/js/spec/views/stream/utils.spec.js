import utils from 'app/views/stream/utils';

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
});
