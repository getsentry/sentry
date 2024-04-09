import isValidOrgSlug from './isValidOrgSlug';

describe('isValidOrgSlug', function () {
  it('validates org slugs', function () {
    // valid org slugs
    expect(isValidOrgSlug('a')).toBe(true);
    expect(isValidOrgSlug('CaNaDa')).toBe(true);
    expect(isValidOrgSlug('foobar123')).toBe(true);
    expect(isValidOrgSlug('albertos-apples')).toBe(true);

    expect(isValidOrgSlug('albertos_apples')).toBe(false);
    expect(isValidOrgSlug('sentry-')).toBe(false);
    expect(isValidOrgSlug('-sentry')).toBe(false);
    expect(isValidOrgSlug('1234')).toBe(false);
    expect(isValidOrgSlug('-')).toBe(false);
    expect(isValidOrgSlug('_')).toBe(false);
    expect(isValidOrgSlug('')).toBe(false);
  });
});
