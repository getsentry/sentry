import parseUrl from 'sentry/utils/url/parseUrl';

describe('parseUrl', () => {
  it('should return a URL object when a valid string is passed', () => {
    expect(parseUrl('https://example.com')).toStrictEqual(expect.any(URL));
  });

  it('should return undefined, not throw, when an invalid string is passed', () => {
    expect(parseUrl('foo')).toBeUndefined();
  });
});
