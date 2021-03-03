import {getDiscoverConditionsToSearchString} from 'app/views/dashboards/utils/getDiscoverConditionsToSearchString';

describe('getDiscoverConditionsToSearchString', function () {
  it('handles empty conditions', function () {
    expect(getDiscoverConditionsToSearchString([])).toBe('');
  });

  it('string equality', function () {
    expect(
      getDiscoverConditionsToSearchString([['user.email', '=', 'billy@sentry.io']])
    ).toBe('user.email:billy@sentry.io');
  });

  it('string equality negation', function () {
    expect(
      getDiscoverConditionsToSearchString([['user.email', '!=', 'billy@sentry.io']])
    ).toBe('!user.email:billy@sentry.io');
  });

  it('searches for strings with wildcards', function () {
    expect(
      getDiscoverConditionsToSearchString([['user.email', 'LIKE', '%@sentry.io']])
    ).toBe('user.email:*@sentry.io');
  });

  it('negation searches for strings with wildcards', function () {
    expect(
      getDiscoverConditionsToSearchString([['user.email', 'NOT LIKE', '%@sentry.io']])
    ).toBe('!user.email:*@sentry.io');
  });

  it('is null', function () {
    expect(getDiscoverConditionsToSearchString([['user.email', 'IS NULL', null]])).toBe(
      'user.email:""'
    );
  });

  it('is not null', function () {
    expect(
      getDiscoverConditionsToSearchString([['user.email', 'IS NOT NULL', null]])
    ).toBe('!user.email:""');
  });

  it('handles multiple conditions', function () {
    expect(
      getDiscoverConditionsToSearchString([
        ['user.email', 'IS NOT NULL', null],
        ['user.email', 'LIKE', '%@sentry%'],
      ])
    ).toBe('!user.email:"" user.email:*@sentry*');
  });
});
