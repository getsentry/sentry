import {capitalize} from 'sentry/utils/string/capitalize';

describe('capitalize', () => {
  it('capitalizes the first letter of a string', () => {
    expect(capitalize('hello')).toEqual('Hello');
  });

  it('does not change the string if it is already capitalized', () => {
    expect(capitalize('Hello')).toEqual('Hello');
  });
});
