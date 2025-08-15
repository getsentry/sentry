import {parseRepo} from 'sentry/utils/git/parseRepo';

describe('parseRepo', () => {
  it('should work for simple github url', () => {
    expect(parseRepo('github.com/example/example')).toBe('example/example');
  });
  it('should work for full github url', () => {
    expect(parseRepo('https://github.com/example/example')).toBe('example/example');
  });
  it('should work for trailing slash', () => {
    expect(parseRepo('https://github.com/example/example/')).toBe('example/example');
  });
  it('should work for simple BitBucket url', () => {
    expect(parseRepo('bitbucket.org/example/example')).toBe('example/example');
  });
  it('should work for full BitBucket url', () => {
    expect(parseRepo('https://bitbucket.org/example/example')).toBe('example/example');
  });
  it('should work for trailing Bitbucket slash', () => {
    expect(parseRepo('https://bitbucket.org/example/example/')).toBe('example/example');
  });
  it('should work for repo only', () => {
    expect(parseRepo('example/example')).toBe('example/example');
  });
  it('should parse repo from url with extra info', () => {
    expect(parseRepo('github.com/example/example/commits/adsadsa')).toBe(
      'example/example'
    );
  });
});
