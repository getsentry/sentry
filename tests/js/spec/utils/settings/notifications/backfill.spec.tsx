import {backfillMissingProvidersWithFallback} from 'sentry/views/settings/account/notifications/utils';

describe('backfillMissingProvidersWithFallback', () => {
  describe('when scopeType is user', () => {
    it('should add missing provider with the fallback value', () => {
      expect(
        backfillMissingProvidersWithFallback({}, ['email'], 'sometimes', 'user')
      ).toEqual({email: 'sometimes', slack: 'never'});
    });

    it('should turn on both providers with the fallback value', () => {
      expect(
        backfillMissingProvidersWithFallback(
          {email: 'never', slack: 'never'},
          ['email', 'slack'],
          'sometimes',
          'user'
        )
      ).toEqual({email: 'sometimes', slack: 'sometimes'});
    });

    it('should move the existing setting when providers are swapped', () => {
      expect(
        backfillMissingProvidersWithFallback(
          {email: 'always', slack: 'never'},
          ['slack'],
          '',
          'user'
        )
      ).toEqual({email: 'never', slack: 'always'});
    });

    it('should turn off both providers when providers is empty', () => {
      expect(
        backfillMissingProvidersWithFallback(
          {email: 'always', slack: 'always'},
          [],
          '',
          'user'
        )
      ).toEqual({email: 'never', slack: 'never'});
    });
  });
  describe('when scopeType is organization', () => {
    it('should retain OFF organization scope preference when provider list changes', () => {
      expect(
        backfillMissingProvidersWithFallback(
          {email: 'never', slack: 'never'},
          ['slack'],
          'sometimes',
          'organization'
        )
      ).toEqual({email: 'never', slack: 'never'});
    });
  });
});
