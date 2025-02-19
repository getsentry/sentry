import ConfigStore from 'sentry/stores/configStore';

import {
  extraQueryParameter,
  extraQueryParameterWithEmail,
  isDemoModeEnabled,
  urlAttachQueryParams,
} from './';

describe('Demo Mode Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.useFakeTimers();
  });

  describe('extraQueryParameter', () => {
    it('returns empty URLSearchParams if no extraQueryString is set', () => {
      window.SandboxData = {};
      const params = extraQueryParameter();
      expect(params.toString()).toBe('');
    });

    it('returns URLSearchParams from extraQueryString', () => {
      window.SandboxData = {extraQueryString: 'key=value&key2=value2'};
      const params = extraQueryParameter();
      expect(params.get('key')).toBe('value');
      expect(params.get('key2')).toBe('value2');
    });
  });

  describe('extraQueryParameterWithEmail', () => {
    it('appends email to URLSearchParams if present in localStorage', () => {
      localStorage.setItem('email', 'test@example.com');
      window.SandboxData = {extraQueryString: 'key=value'};
      const params = extraQueryParameterWithEmail();
      expect(params.get('email')).toBe('test@example.com');
    });

    it('does not append email if not present in localStorage', () => {
      window.SandboxData = {extraQueryString: 'key=value'};
      const params = extraQueryParameterWithEmail();
      expect(params.get('email')).toBeNull();
    });
  });

  describe('urlAttachQueryParams', () => {
    it('attaches query parameters to the URL', () => {
      const params = new URLSearchParams('key=value');
      const url = 'http://example.com';
      const result = urlAttachQueryParams(url, params);
      expect(result).toBe('http://example.com?key=value');
    });

    it('returns the original URL if no query parameters', () => {
      const params = new URLSearchParams();
      const url = 'http://example.com';
      const result = urlAttachQueryParams(url, params);
      expect(result).toBe('http://example.com');
    });
  });

  describe('isDemoModeEnabled', () => {
    it('returns true if demoMode is enabled and user is not a superuser', () => {
      jest.spyOn(ConfigStore, 'get').mockReturnValue(true);
      jest
        .spyOn(require('sentry/utils/isActiveSuperuser'), 'isActiveSuperuser')
        .mockReturnValue(false);
      expect(isDemoModeEnabled()).toBe(true);
    });

    it('returns false if demoMode is enabled but user is a superuser', () => {
      jest.spyOn(ConfigStore, 'get').mockReturnValue(true);
      jest
        .spyOn(require('sentry/utils/isActiveSuperuser'), 'isActiveSuperuser')
        .mockReturnValue(true);
      expect(isDemoModeEnabled()).toBe(false);
    });

    it('returns false if demoMode is not enabled', () => {
      jest.spyOn(ConfigStore, 'get').mockReturnValue(false);
      expect(isDemoModeEnabled()).toBe(false);
    });
  });
});
