import {
  getANRIssueQueryText,
  getANRRateText,
  isPlatformANRCompatible,
  isPlatformForegroundANRCompatible,
} from './utils';

describe('ProjectDetail Utils', function () {
  describe('isPlatformANRCompatible', function () {
    it('returns true for compatible platforms', function () {
      expect(isPlatformANRCompatible('javascript-electron')).toBe(true);
      expect(isPlatformANRCompatible('android')).toBe(true);
    });

    it('returns true for apple projects when the feature flag is enabled', function () {
      expect(
        isPlatformANRCompatible('apple', ['project-detail-apple-app-hang-rate'])
      ).toBe(true);

      expect(
        isPlatformANRCompatible('apple-ios', ['project-detail-apple-app-hang-rate'])
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

  describe('getANRRateText', function () {
    it('returns "App Hang Rate" for apple platforms', function () {
      expect(getANRRateText('apple')).toBe('App Hang Rate');
      expect(getANRRateText('apple-ios')).toBe('App Hang Rate');
    });

    it('returns "ANR Rate" for other platforms', function () {
      expect(getANRRateText('apple-macos')).toBe('ANR Rate');
      expect(getANRRateText('android')).toBe('ANR Rate');
      expect(getANRRateText('javascript-electron')).toBe('ANR Rate');
      expect(getANRRateText('python')).toBe('ANR Rate');
      expect(getANRRateText(undefined)).toBe('ANR Rate');
    });
  });

  describe('getANRIssueQueryText', () => {
    it('returns correct query text for apple platforms', () => {
      expect(getANRIssueQueryText('apple')).toBe(
        'error.type:["Fatal App Hang Fully Blocked","Fatal App Hang Non Fully Blocked"]'
      );
      expect(getANRIssueQueryText('apple-ios')).toBe(
        'error.type:["Fatal App Hang Fully Blocked","Fatal App Hang Non Fully Blocked"]'
      );
    });

    it('returns correct query text for android platform', () => {
      expect(getANRIssueQueryText('android')).toBe('mechanism:[ANR,AppExitInfo]');
    });

    it('returns correct query text for other platforms', () => {
      expect(getANRIssueQueryText('windows')).toBe('mechanism:[ANR,AppExitInfo]');
      expect(getANRIssueQueryText()).toBe('mechanism:[ANR,AppExitInfo]');
    });
  });
});
