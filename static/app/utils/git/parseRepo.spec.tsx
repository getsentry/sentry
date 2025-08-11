import {parseRepo} from 'sentry/utils/git/parseRepo';

describe('parseRepo', function () {
  it('should work for simple github url', function () {
    expect(parseRepo('github.com/example/example')).toBe('example/example');
  });
  it('should work for full github url', function () {
    expect(parseRepo('https://github.com/example/example')).toBe('example/example');
  });
  it('should work for trailing slash', function () {
    expect(parseRepo('https://github.com/example/example/')).toBe('example/example');
  });
  it('should work for simple BitBucket url', function () {
    expect(parseRepo('bitbucket.org/example/example')).toBe('example/example');
  });
  it('should work for full BitBucket url', function () {
    expect(parseRepo('https://bitbucket.org/example/example')).toBe('example/example');
  });
  it('should work for trailing Bitbucket slash', function () {
    expect(parseRepo('https://bitbucket.org/example/example/')).toBe('example/example');
  });
  it('should work for repo only', function () {
    expect(parseRepo('example/example')).toBe('example/example');
  });
  it('should parse repo from url with extra info', function () {
    expect(parseRepo('github.com/example/example/commits/adsadsa')).toBe(
      'example/example'
    );
  });
});
