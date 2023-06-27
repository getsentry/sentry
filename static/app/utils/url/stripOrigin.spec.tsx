import stripOrigin from 'sentry/utils/url/stripOrigin';

describe('stripOrigin', () => {
  it('should preserve the url path, query, and hash', () => {
    expect(stripOrigin('https://example.com/path/name?query=params#hash')).toEqual(
      '/path/name?query=params#hash'
    );
  });

  it.each([
    'foo bar baz',
    '/path/name?query=params#hash',
    '/[a-z]@[a-z].com/',
    'nulltext/html;base64,PHNjcmlwdD4KICAgICAgb25tZXNzYWdlID0gKGV2ZW50KSA9PiB7CiAgICAgICAgY29uc29sZS5sb2coJ2hlbGxvIHdvcmxkJyk7CiAgICAgIH0KICA8L3NjcmlwdD4=',
  ])(
    'should return the the same string, when something is not parseable as a url',
    str => {
      expect(stripOrigin(str)).toEqual(str);
    }
  );
});
