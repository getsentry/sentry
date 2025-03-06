import {
  getANRRateText,
  isPlatformANRCompatible,
  isPlatformForegroundANRCompatible,
} from './utils';

describe('ProjectDetail Utils', function () {
  describe('isPlatformANRCompatible', function () {
    it('returns true for compatible platforms', function () {
      expect(isPlatformANRCompatible('javascript-electron')).toBe(true);
      expect(isPlatformANRCompatible('android')).toBe(true);
      expect(isPlatformANRCompatible('apple')).toBe(true);
      expect(isPlatformANRCompatible('apple-ios')).toBe(true);
    });

    it('returns false for incompatible platforms', function () {
      expect(isPlatformANRCompatible('python')).toBe(false);
      expect(isPlatformANRCompatible('node')).toBe(false);
      expect(isPlatformANRCompatible(undefined)).toBe(false);
      expect(isPlatformANRCompatible('apple-macos')).toBe(false);
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

  describe('getANRRateText', function () {
    it('returns "App Hang Rate" for apple platforms', function () {
      expect(getANRRateText('apple')).toBe('App Hang Rate');
      expect(getANRRateText('apple-ios')).toBe('App Hang Rate');
      expect(getANRRateText('apple-macos')).toBe('App Hang Rate');
    });

    it('returns "ANR Rate" for other platforms', function () {
      expect(getANRRateText('android')).toBe('ANR Rate');
      expect(getANRRateText('javascript-electron')).toBe('ANR Rate');
      expect(getANRRateText('python')).toBe('ANR Rate');
      expect(getANRRateText(undefined)).toBe('ANR Rate');
    });
  });
});
