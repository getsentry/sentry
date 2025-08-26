import slugify from 'sentry/utils/slugify';

describe('slugify', () => {
  it('forces to lowercase', () => {
    expect(slugify('STOPYELLING')).toBe('stopyelling');
  });

  it('replaces space with a hyphen', () => {
    expect(slugify('STOP YELLING')).toBe('stop-yelling');
  });

  it('replaces all spaces with a hyphen', () => {
    expect(slugify('STOP YELLING AT ME')).toBe('stop-yelling-at-me');
  });

  it('replaces accented characters', () => {
    expect(slugify('Áá')).toBe('aa');
  });

  it('splits ligatures', () => {
    expect(slugify('ﬁ')).toBe('fi');
  });

  it('Removes special characters', () => {
    expect(slugify("some#chars%shouldn't*be.here")).toBe('somecharsshouldntbehere');
  });

  it('keeps hyphens and underscores', () => {
    expect(slugify('_some-chars__should-stay')).toBe('_some-chars__should-stay');
  });
});
