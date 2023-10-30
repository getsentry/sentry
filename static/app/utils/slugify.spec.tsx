import slugify from 'sentry/utils/slugify';

describe('slugify', function () {
  it('forces to lowercase', function () {
    expect(slugify('STOPYELLING')).toBe('stopyelling');
  });

  it('replaces spaces with a hyphen', function () {
    expect(slugify('STOP YELLING')).toBe('stop-yelling');
  });

  it('replaces accented characters', function () {
    expect(slugify('Áá')).toBe('aa');
  });

  it('splits ligatures', function () {
    expect(slugify('ﬁ')).toBe('fi');
  });

  it('Removes special characters', function () {
    expect(slugify("some#chars%shouldn't*be.here")).toBe('somecharsshouldntbehere');
  });

  it('keeps hyphens and underscores', function () {
    expect(slugify('_some-chars__should-stay')).toBe('_some-chars__should-stay');
  });
});
