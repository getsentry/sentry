import {
  getANRIssueQueryText,
  getANRRateText,
  isPlatformANRCompatible,
  isPlatformForegroundANRCompatible,
} from './utils';

describe('ProjectDetail Utils', () => {
  describe('isPlatformANRCompatible', () => {
    it('returns true for compatible platforms', () => {
      expect(isPlatformANRCompatible('javascript-electron')).toBe(true);
      expect(isPlatformANRCompatible('android')).toBe(true);
    });

    it('returns true for apple platforms', () => {
      expect(isPlatformANRCompatible('apple')).toBe(true);
      expect(isPlatformANRCompatible('apple-ios')).toBe(true);
    });

    it('returns false for incompatible platforms', () => {
      expect(isPlatformANRCompatible('python')).toBe(false);
      expect(isPlatformANRCompatible('node')).toBe(false);
      expect(isPlatformANRCompatible(undefined)).toBe(false);
      expect(isPlatformANRCompatible('apple-macos')).toBe(false);
    });
  });

  describe('isPlatformForegroundANRCompatible', () => {
    it('returns true for compatible platforms', () => {
      expect(isPlatformForegroundANRCompatible('javascript-electron')).toBe(true);
      expect(isPlatformForegroundANRCompatible('android')).toBe(true);
    });

    it('returns false for incompatible platforms', () => {
      expect(isPlatformForegroundANRCompatible('apple')).toBe(false);
      expect(isPlatformForegroundANRCompatible('apple-ios')).toBe(false);
      expect(isPlatformForegroundANRCompatible('apple-macos')).toBe(false);
      expect(isPlatformForegroundANRCompatible('python')).toBe(false);
      expect(isPlatformForegroundANRCompatible(undefined)).toBe(false);
    });
  });

  describe('getANRRateText', () => {
    it('returns "App Hang Rate" for apple platforms', () => {
      expect(getANRRateText('apple')).toBe('App Hang Rate');
      expect(getANRRateText('apple-ios')).toBe('App Hang Rate');
    });

    it('returns "ANR Rate" for other platforms', () => {
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
      expect(getANRIssueQueryText('other')).toBe('mechanism:[ANR,AppExitInfo]');
      expect(getANRIssueQueryText()).toBe('mechanism:[ANR,AppExitInfo]');
    });
  });
});
