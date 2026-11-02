import {OrganizationFixture} from 'sentry-fixture/organization';

import {FeatureFlagOverrides} from './featureFlagOverrides';
import {localStorageWrapper} from './localStorage';

const LOCALSTORAGE_KEY = 'feature-flag-overrides';

describe('FeatureFlagOverrides', () => {
  let organization: any;
  beforeEach(() => {
    localStorage.clear();

    organization = OrganizationFixture({
      features: ['issue-views', 'profiling', 'session-replay-ui'],
    });
  });

  describe('getOverrides', () => {
    it('preserves unknown names and ignores non-boolean stored values', () => {
      localStorageWrapper.setItem(
        LOCALSTORAGE_KEY,
        JSON.stringify({'future-feature': true, 'issue-views': 'true', profiling: false})
      );

      expect(new FeatureFlagOverrides().getStoredOverrides()).toEqual({
        'future-feature': true,
        profiling: false,
      });
    });

    it.each(['null', '[]', '42'])('ignores non-object stored data %s', stored => {
      localStorageWrapper.setItem(LOCALSTORAGE_KEY, stored);
      expect(new FeatureFlagOverrides().getStoredOverrides()).toEqual({});
    });
    it('should return all manually overridden flags', () => {
      localStorageWrapper.setItem(
        LOCALSTORAGE_KEY,
        '{"issue-views":false,"profiling":true}'
      );
      const inst = new FeatureFlagOverrides();

      expect(inst.getStoredOverrides()).toEqual({
        'issue-views': false,
        profiling: true,
      });
    });
  });

  describe('setStoredOverride', () => {
    it('should insert new flag names into localstorage', () => {
      expect(localStorageWrapper.getItem(LOCALSTORAGE_KEY)).toBeNull();
      const inst = new FeatureFlagOverrides();

      inst.setStoredOverride('issue-views', false);
      expect(localStorageWrapper.getItem(LOCALSTORAGE_KEY)).toBe('{"issue-views":false}');

      inst.setStoredOverride('issue-views', true);
      expect(localStorageWrapper.getItem(LOCALSTORAGE_KEY)).toBe('{"issue-views":true}');
    });

    it('should preserve other flag overrides in localstorage', () => {
      localStorageWrapper.setItem(
        LOCALSTORAGE_KEY,
        '{"issue-views":true,"profiling":false}'
      );
      const inst = new FeatureFlagOverrides();

      inst.setStoredOverride('session-replay-ui', false);
      expect(localStorageWrapper.getItem(LOCALSTORAGE_KEY)).toBe(
        '{"issue-views":true,"profiling":false,"session-replay-ui":false}'
      );

      inst.setStoredOverride('session-replay-ui', true);
      expect(localStorageWrapper.getItem(LOCALSTORAGE_KEY)).toBe(
        '{"issue-views":true,"profiling":false,"session-replay-ui":true}'
      );
    });

    it('should set localstorage, even if the original value is malformed', () => {
      localStorageWrapper.setItem(LOCALSTORAGE_KEY, 'this is not an object {}');
      const inst = new FeatureFlagOverrides();

      inst.setStoredOverride('issue-views', false);
      expect(localStorageWrapper.getItem(LOCALSTORAGE_KEY)).toBe('{"issue-views":false}');
    });
  });

  describe('getEnabledFeatureFlagList', () => {
    it('should combine & remove features that are disabled locally', () => {
      localStorageWrapper.setItem(
        LOCALSTORAGE_KEY,
        '{"issue-views":false,"profiling":true}'
      );
      const inst = new FeatureFlagOverrides();

      // The original values
      expect(organization.features).toEqual([
        'issue-views',
        'profiling',
        'session-replay-ui',
      ]);

      // The overridden values
      expect(inst.getStoredOverrides()).toEqual({
        'issue-views': false,
        profiling: true,
      });

      // The combined values
      expect(inst.getEnabledFeatureFlagList(organization)).toEqual([
        'profiling',
        'session-replay-ui',
      ]);
    });

    it('should combine & add features that are listed locally, but not in the org', () => {
      localStorageWrapper.setItem(
        LOCALSTORAGE_KEY,
        '{"issue-views":false,"secret-new-feature":true,"local-only-feature":false}'
      );
      const inst = new FeatureFlagOverrides();

      expect(inst.getEnabledFeatureFlagList(organization)).toEqual([
        'profiling',
        'session-replay-ui',
        'secret-new-feature',
      ]);
    });
  });

  describe('loadOrg', () => {
    it('should override the features on an org with the combined list', () => {
      localStorageWrapper.setItem(
        LOCALSTORAGE_KEY,
        '{"issue-views":false,"secret-new-feature":true,"local-only-feature":false}'
      );
      const inst = new FeatureFlagOverrides();

      expect(organization.features).toEqual([
        'issue-views',
        'profiling',
        'session-replay-ui',
      ]);

      inst.loadOrg(organization);

      expect(organization.features).toEqual([
        'profiling',
        'session-replay-ui',
        'secret-new-feature',
      ]);
    });
  });
});
