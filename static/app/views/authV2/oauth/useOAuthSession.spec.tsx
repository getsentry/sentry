import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useOAuthSession} from './useOAuthSession';

it.each(['initial login', 'account switch'])(
  'prepares organization login before showing MFA during %s',
  async entry => {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {
        pendingMfa: {mfaRequired: true, mfaMethods: [{id: 'totp'}]},
        singleOrganizationSlug: 'org-slug',
        serverHostname: 'sentry.example.com',
        canRegister: false,
        hasNewsletter: false,
      },
    });
    MockApiClient.addMockResponse({url: '/auth/', method: 'DELETE', body: {}});
    MockApiClient.addMockResponse({url: '/auth-v2/csrf/', body: {}});
    const delay = Promise.withResolvers<void>();
    const organization = MockApiClient.addMockResponse({
      url: '/auth/organizations/org-slug/config/',
      body: {
        organization: {name: 'Example Org', slug: 'org-slug', avatarUrl: null},
        loginMethod: 'password',
      },
      asyncDelay: delay.promise,
    });
    const {result} = renderHookWithProviders(() => useOAuthSession('/oauth/authorize/'));

    act(() => {
      if (entry === 'account switch') {
        result.current.switchAccount.mutate();
      } else {
        result.current.requireAuthentication();
      }
    });

    await waitFor(() => expect(organization).toHaveBeenCalled());

    if (entry === 'account switch') {
      expect(result.current.switchAccount.isPending).toBe(true);
    } else {
      expect(result.current.isAuthenticationReady).toBe(false);
    }

    await act(() => {
      delay.resolve();
      return delay.promise;
    });

    await waitFor(() => {
      expect(result.current.needsAuthentication).toBe(true);
      expect(result.current.isAuthenticationReady).toBe(true);
      expect(result.current.switchAccount.isPending).toBe(false);
    });
  }
);
