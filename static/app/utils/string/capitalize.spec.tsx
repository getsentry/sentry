import {capitalize} from 'sentry/utils/string/capitalize';

describe('capitalize', () => {
  it('capitalizes the first letter of a string', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('lowercases the rest of the string', () => {
    expect(capitalize('HELLO')).toBe('Hello');
  });

  it('does not change the string if it is already capitalized', () => {
    expect(capitalize('Hello')).toBe('Hello');
  });
});
