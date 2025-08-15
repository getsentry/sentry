import {sanitizeQuerySelector} from 'sentry/utils/sanitizeQuerySelector';

describe('sanitizeQuerySelector', () => {
  it('replaces all spaces with a hyphen', () => {
    expect(sanitizeQuerySelector('foo bar baz bar foo')).toBe('foo-bar-baz-bar-foo');
  });

  it('replaces colons with a hyphen', () => {
    expect(sanitizeQuerySelector('foo:bar:baz bar foo')).toBe('foo-bar-baz-bar-foo');
  });
});
