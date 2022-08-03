import {backfillMissingProvidersWithFallback} from 'sentry/views/settings/account/notifications/utils';

describe('backfillMissingProvidersWithFallback', () => {
  describe('when scopeType is user', () => {
    it('should add missing provider with the fallback value', () => {
      expect(
        backfillMissingProvidersWithFallback({}, ['email'], 'sometimes', 'user')
      ).toEqual({email: 'sometimes', slack: 'never', msteams: 'never'});
    });

    it('should turn on all providers with the fallback value', () => {
      expect(
        backfillMissingProvidersWithFallback(
          {email: 'never', slack: 'never', msteams: 'never'},
          ['email', 'slack', 'msteams'],
          'sometimes',
          'user'
        )
      ).toEqual({email: 'sometimes', slack: 'sometimes', msteams: 'sometimes'});
    });

    it('should move the existing setting when providers are swapped', () => {
      expect(
        backfillMissingProvidersWithFallback(
          {email: 'always', slack: 'never', msteams: 'never'},
          ['slack', 'msteams'],
          '',
          'user'
        )
      ).toEqual({email: 'never', slack: 'always', msteams: 'always'});
    });

    it('should turn off all providers when providers is empty', () => {
      expect(
        backfillMissingProvidersWithFallback(
          {email: 'always', slack: 'always', msteams: 'always'},
          [],
          '',
          'user'
        )
      ).toEqual({email: 'never', slack: 'never', msteams: 'never'});
    });
  });
  describe('when scopeType is organization', () => {
    it('should retain OFF organization scope preference when provider list changes', () => {
      expect(
        backfillMissingProvidersWithFallback(
          {email: 'never', slack: 'never', msteams: 'never'},
          ['slack'],
          'sometimes',
          'organization'
        )
      ).toEqual({email: 'never', slack: 'never', msteams: 'never'});
    });
  });
});
