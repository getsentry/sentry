import {sanitizeQuerySelector} from 'app/utils/sanitizeQuerySelector';

describe('sanitizeQuerySelector', function () {
  it('replaces all spaces with a hyphen', function () {
    expect(sanitizeQuerySelector('foo bar baz bar foo')).toBe('foo-bar-baz-bar-foo');
  });

  it('replaces colons with a hyphen', function () {
    expect(sanitizeQuerySelector('foo:bar:baz bar foo')).toBe('foo-bar-baz-bar-foo');
  });

  it('returns an empty string if passed undefined', function () {
    expect(sanitizeQuerySelector()).toBe('');
  });
});
