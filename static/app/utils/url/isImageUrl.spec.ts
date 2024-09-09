import {isImageUrl} from 'sentry/utils/url/isImageUrl';

describe('isImageUrl', function () {
  it('the URL is an image', function () {
    const url = 'https://example.com/image.jpg';
    const result = isImageUrl(url);
    expect(result).toBe(true);
  });
  it('the URL is not an image', function () {
    const url = 'https://example.com/image.txt';
    const result = isImageUrl(url);
    expect(result).toBe(false);
  });
});
