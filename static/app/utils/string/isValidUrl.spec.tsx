import {isValidUrl} from 'sentry/utils/string/isValidUrl';

describe('isValidUrl', () => {
  it.each([
    'https://example.com/path',
    'http://localhost:8080/api',
    'http://my-service/api',
    'http://127.0.0.1/path',
    'http://[::1]/path',
  ])('returns true for navigable URL %s', url => {
    expect(isValidUrl(url)).toBe(true);
  });

  it.each([
    'not-a-url',
    'ftp://example.com/path',
    'http://*/v1/api/auth/register',
    'http://{host}/v1/api/auth/register',
  ])('returns false for non-navigable URL %s', url => {
    expect(isValidUrl(url)).toBe(false);
  });

  it('returns false for javascript URLs', () => {
    // eslint-disable-next-line no-script-url
    expect(isValidUrl('javascript:void(0)')).toBe(false);
  });
});
