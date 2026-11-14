import {useQuery} from '@tanstack/react-query';
import {UserFixture} from 'sentry-fixture/user';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import type {AuthConfig} from 'sentry/types/auth';

import {authorizationConsentQueryOptions} from './queries';
import {useOAuthAuthenticationState} from './useOAuthAuthenticationState';
import {useOAuthSession} from './useOAuthSession';

const loginConfig: AuthConfig = {
  pendingMfa: null,
  serverHostname: 'sentry.example.com',
  canRegister: false,
  hasNewsletter: false,
};

function useAuthentication() {
  const session = useOAuthSession('/oauth/authorize/');
  const consent = useQuery({
    ...authorizationConsentQueryOptions({}, session.sessionKey),
    enabled: !session.needsAuthentication,
  });
  const state = useOAuthAuthenticationState({
    session,
    consentError: consent.error,
    isPreparingConsent: consent.isPending,
  });

  return {state, onAuthenticated: session.onAuthenticated};
}

describe('useOAuthAuthenticationState', () => {
  const originalConfig = ConfigStore.getState();

  beforeEach(() => {
    ConfigStore.set('user', UserFixture());
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      statusCode: 403,
      body: {detail: 'Consent forbidden.'},
    });
  });

  afterEach(() => ConfigStore.loadInitialData(originalConfig));

  it.each([null, {mfaRequired: true, mfaMethods: [{id: 'totp' as const}]}])(
    'waits for configuration before presenting authentication with pending MFA %j',
    async pendingMfa => {
      const delay = Promise.withResolvers<void>();
      const config = {...loginConfig, pendingMfa};
      const request = MockApiClient.addMockResponse({
        url: '/auth/config/',
        body: config,
        asyncDelay: delay.promise,
      });
      const {result} = renderHookWithProviders(useAuthentication);

      await waitFor(() => expect(request).toHaveBeenCalled());
      expect(result.current.state.status).toBe('loading');

      await act(() => {
        delay.resolve();
        return delay.promise;
      });

      await waitFor(() =>
        expect(result.current.state).toEqual({
          status: 'authentication',
          authConfig: config,
          isPreparingConsent: false,
        })
      );
    }
  );

  it('treats authenticated configuration as an access denial', async () => {
    MockApiClient.addMockResponse({url: '/auth/config/', body: {nextUri: '/home/'}});
    const {result} = renderHookWithProviders(useAuthentication);

    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: 'error',
        message: 'Consent forbidden.',
        canRetry: false,
      })
    );
  });

  it('waits for single-organization login configuration before revealing authentication', async () => {
    const config = {...loginConfig, singleOrganizationSlug: 'org-slug'};
    MockApiClient.addMockResponse({url: '/auth/config/', body: config});
    const delay = Promise.withResolvers<void>();
    const organization = MockApiClient.addMockResponse({
      url: '/auth/organizations/org-slug/config/',
      body: {
        organization: {name: 'Example Org', slug: 'org-slug', avatarUrl: null},
        loginMethod: 'password',
      },
      asyncDelay: delay.promise,
    });
    const {result} = renderHookWithProviders(useAuthentication);

    await waitFor(() => expect(organization).toHaveBeenCalled());
    expect(result.current.state.status).toBe('loading');

    await act(() => {
      delay.resolve();
      return delay.promise;
    });

    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: 'authentication',
        authConfig: config,
        isPreparingConsent: false,
      })
    );
  });

  it('keeps completed authentication visible until fresh consent is prepared', async () => {
    MockApiClient.addMockResponse({url: '/auth/config/', body: loginConfig});
    const {result} = renderHookWithProviders(useAuthentication);

    await waitFor(() => expect(result.current.state.status).toBe('authentication'));

    const delay = Promise.withResolvers<void>();
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      body: {
        stage: 'consent',
        transactionId: 'fresh',
        organizationOptions: [],
        hasExistingConsent: false,
      },
      asyncDelay: delay.promise,
    });

    act(() =>
      result.current.onAuthenticated(
        {user: UserFixture(), nextUri: '/home/'},
        loginConfig
      )
    );

    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: 'authentication',
        authConfig: loginConfig,
        isPreparingConsent: true,
      })
    );

    await act(() => {
      delay.resolve();
      return delay.promise;
    });

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
  });
});
