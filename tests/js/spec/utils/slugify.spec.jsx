import slugify from 'app/utils/slugify';

describe('slugify', function () {
  it('forces to lowercase', function () {
    expect(slugify('STOPYELLING')).toBe('stopyelling');
  });

  it('replaces spaces with a hyphen', function () {
    expect(slugify('STOP YELLING')).toBe('stop-yelling');
  });

  it('does not replace other special characters', function () {
    expect(slugify('STOP YELLING!@#')).toBe('stop-yelling!@#');
  });

  it('returns an empty string if passed undefined', function () {
    expect(slugify()).toBe('');
  });
});
