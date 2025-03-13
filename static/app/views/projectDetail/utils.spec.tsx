import {isPlatformANRCompatible, isPlatformForegroundANRCompatible} from './utils';

describe('ProjectDetail Utils', function () {
  describe('isPlatformANRCompatible', function () {
    it('returns true for compatible platforms', function () {
      expect(isPlatformANRCompatible('javascript-electron')).toBe(true);
      expect(isPlatformANRCompatible('android')).toBe(true);
    });

    it('returns true for apple projects when the feature flag is enabled', function () {
      expect(
        isPlatformANRCompatible('apple', ['projects:project-detail-apple-app-hang-rate'])
      ).toBe(true);

      expect(
        isPlatformANRCompatible('apple-ios', [
          'projects:project-detail-apple-app-hang-rate',
        ])
      ).toBe(true);
    });

    it('returns false for apple projects different feature flag is enabled', function () {
      expect(isPlatformANRCompatible('apple', ['empty'])).toBe(false);

      expect(isPlatformANRCompatible('apple', undefined)).toBe(false);
    });

    it('returns false for apple projects when feature flags are undefined', function () {
      expect(isPlatformANRCompatible('apple', undefined)).toBe(false);
    });

    it('returns false for incompatible platforms', function () {
      expect(isPlatformANRCompatible('python')).toBe(false);
      expect(isPlatformANRCompatible('node')).toBe(false);
      expect(isPlatformANRCompatible(undefined)).toBe(false);
      expect(isPlatformANRCompatible('apple-macos')).toBe(false);
      expect(isPlatformANRCompatible('apple-ios')).toBe(false);
    });
  });

  describe('isPlatformForegroundANRCompatible', function () {
    it('returns true for compatible platforms', function () {
      expect(isPlatformForegroundANRCompatible('javascript-electron')).toBe(true);
      expect(isPlatformForegroundANRCompatible('android')).toBe(true);
    });

    it('returns false for incompatible platforms', function () {
      expect(isPlatformForegroundANRCompatible('apple')).toBe(false);
      expect(isPlatformForegroundANRCompatible('apple-ios')).toBe(false);
      expect(isPlatformForegroundANRCompatible('apple-macos')).toBe(false);
      expect(isPlatformForegroundANRCompatible('python')).toBe(false);
      expect(isPlatformForegroundANRCompatible(undefined)).toBe(false);
    });
  });
});
