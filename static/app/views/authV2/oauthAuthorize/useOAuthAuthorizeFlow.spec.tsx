import {OAuthConsentFixture, OAuthContextFixture} from 'sentry-fixture/oauth';
import {UserFixture} from 'sentry-fixture/user';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import type {AuthConfig} from 'sentry/types/auth';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

import {useOAuthAuthorizeFlow} from './useOAuthAuthorizeFlow';

const location = {
  pathname: '/oauth/authorize/',
  query: {client_id: 'example-client', response_type: 'code'},
};
const loginConfig: AuthConfig = {
  pendingMfa: null,
  serverHostname: 'sentry.example.com',
  canRegister: false,
  hasNewsletter: false,
};

describe('useOAuthAuthorizeFlow', () => {
  const originalConfig = ConfigStore.getState();

  beforeEach(() => {
    ConfigStore.set('user', UserFixture());
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/context/',
      body: OAuthContextFixture(),
    });
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      body: OAuthConsentFixture(),
    });
  });

  afterEach(() => ConfigStore.loadInitialData(originalConfig));

  it.each([null, {mfaRequired: true, mfaMethods: [{id: 'totp' as const}]}])(
    'uses auth configuration to resolve a consent 403 with pending MFA %j',
    async pendingMfa => {
      const config = {...loginConfig, pendingMfa};
      MockApiClient.addMockResponse({
        url: '/auth/oauth/authorize/',
        statusCode: 403,
        body: {detail: 'Authentication required.'},
      });
      MockApiClient.addMockResponse({url: '/auth/config/', body: config});

      const {result} = renderHookWithProviders(useOAuthAuthorizeFlow, {
        initialRouterConfig: {location},
      });

      await waitFor(() =>
        expect(result.current.state).toMatchObject({
          status: 'authentication',
          authConfig: config,
          isPreparingConsent: false,
          context: OAuthContextFixture(),
        })
      );
    }
  );

  it('surfaces access denial when auth configuration confirms an authenticated session', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      statusCode: 403,
      body: {detail: 'No eligible organization.'},
    });
    MockApiClient.addMockResponse({url: '/auth/config/', body: {nextUri: '/home/'}});

    const {result} = renderHookWithProviders(useOAuthAuthorizeFlow, {
      initialRouterConfig: {location},
    });

    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: 'error',
        message: 'No eligible organization.',
        canRetry: false,
      })
    );
  });

  it('keeps authentication pending until fresh consent for the signed-in account is ready', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      statusCode: 403,
      body: {detail: 'Authentication required.'},
    });
    MockApiClient.addMockResponse({url: '/auth/config/', body: loginConfig});
    const {result} = renderHookWithProviders(useOAuthAuthorizeFlow, {
      initialRouterConfig: {location},
    });

    await waitFor(() => expect(result.current.state.status).toBe('authentication'));

    const delay = Promise.withResolvers<void>();
    const consent = OAuthConsentFixture({transactionId: 'fresh-transaction'});
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      body: consent,
      asyncDelay: delay.promise,
    });
    const user = UserFixture({id: '2'});

    act(() => {
      result.current.actions.onAuthenticated({user, nextUri: '/home/'}, loginConfig);
    });

    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: 'authentication',
        isPreparingConsent: true,
        authConfig: loginConfig,
      })
    );

    await act(() => {
      delay.resolve();
      return delay.promise;
    });

    await waitFor(() =>
      expect(result.current.state).toMatchObject({status: 'consent', consent, user})
    );
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
  });

  it('submits existing consent once and follows the decision callback', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      body: OAuthConsentFixture({hasExistingConsent: true}),
    });
    const approve = MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      method: 'POST',
      body: {stage: 'redirect', redirectUrl: 'https://example.com/callback?code=issued'},
    });
    const {result, rerender} = renderHookWithProviders(useOAuthAuthorizeFlow, {
      initialRouterConfig: {location},
    });

    await waitFor(() =>
      expect(testableWindowLocation.assign).toHaveBeenCalledWith(
        'https://example.com/callback?code=issued'
      )
    );

    rerender();

    expect(result.current.state.status).toBe('submitting');
    expect(approve).toHaveBeenCalledTimes(1);
    expect(approve).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {transactionId: 'prepared-transaction', op: 'approve'},
      })
    );
  });

  it.each(['1', 'false'])(
    'requires an explicit decision with force_prompt=%s',
    async forcePrompt => {
      MockApiClient.addMockResponse({
        url: '/auth/oauth/authorize/',
        body: OAuthConsentFixture({hasExistingConsent: true}),
      });
      const decide = MockApiClient.addMockResponse({
        url: '/auth/oauth/authorize/',
        method: 'POST',
        body: {stage: 'redirect', redirectUrl: 'https://example.com/callback'},
      });
      const {result} = renderHookWithProviders(useOAuthAuthorizeFlow, {
        initialRouterConfig: {
          location: {...location, query: {...location.query, force_prompt: forcePrompt}},
        },
      });

      await waitFor(() => expect(result.current.state.status).toBe('consent'));
      expect(decide).not.toHaveBeenCalled();

      act(() => result.current.actions.decide('approve', 'selected-org'));

      await waitFor(() =>
        expect(decide).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: {
              transactionId: 'prepared-transaction',
              op: 'approve',
              selectedOrganizationId: 'selected-org',
            },
          })
        )
      );
    }
  );

  it('blocks decisions for the previous account while switching and after logout', async () => {
    const delay = Promise.withResolvers<void>();
    MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
      body: {},
      asyncDelay: delay.promise,
    });
    MockApiClient.addMockResponse({url: '/auth-v2/csrf/', body: {}});
    MockApiClient.addMockResponse({url: '/auth/config/', body: loginConfig});
    const decide = MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      method: 'POST',
      body: {},
    });
    const {result} = renderHookWithProviders(useOAuthAuthorizeFlow, {
      initialRouterConfig: {location},
    });

    await waitFor(() => expect(result.current.state.status).toBe('consent'));

    act(() => result.current.actions.switchAccount());

    await waitFor(() => expect(result.current.state.isSwitchingAccount).toBe(true));

    act(() => result.current.actions.decide('approve'));

    expect(decide).not.toHaveBeenCalled();

    await act(() => {
      delay.resolve();
      return delay.promise;
    });

    await waitFor(() => expect(result.current.state.status).toBe('authentication'));

    act(() => result.current.actions.decide('deny'));

    expect(decide).not.toHaveBeenCalled();
  });

  it('prepares consent for a new account after a failed decision', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      method: 'POST',
      statusCode: 503,
      body: {detail: 'Approval unavailable.'},
    });
    MockApiClient.addMockResponse({url: '/auth/', method: 'DELETE', body: {}});
    MockApiClient.addMockResponse({url: '/auth-v2/csrf/', body: {}});
    MockApiClient.addMockResponse({url: '/auth/config/', body: loginConfig});
    const {result} = renderHookWithProviders(useOAuthAuthorizeFlow, {
      initialRouterConfig: {location},
    });

    await waitFor(() => expect(result.current.state.status).toBe('consent'));

    act(() => result.current.actions.decide('approve'));

    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: 'error',
        message: 'Approval unavailable.',
      })
    );

    act(() => result.current.actions.switchAccount());

    await waitFor(() => expect(result.current.state.status).toBe('authentication'));

    const consent = OAuthConsentFixture({transactionId: 'new-account-transaction'});
    const user = UserFixture({id: '2'});
    MockApiClient.addMockResponse({url: '/auth/oauth/authorize/', body: consent});

    act(() => {
      result.current.actions.onAuthenticated({user, nextUri: '/home/'}, loginConfig);
    });

    await waitFor(() =>
      expect(result.current.state).toMatchObject({status: 'consent', consent, user})
    );
  });

  it('retries a transient preparation failure with a fresh consent transaction', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/oauth/authorize/',
      statusCode: 503,
      body: {detail: 'Temporarily unavailable.'},
    });
    const {result} = renderHookWithProviders(useOAuthAuthorizeFlow, {
      initialRouterConfig: {location},
    });

    await waitFor(() =>
      expect(result.current.state).toMatchObject({status: 'error', canRetry: true})
    );

    const consent = OAuthConsentFixture({transactionId: 'retry-transaction'});
    MockApiClient.addMockResponse({url: '/auth/oauth/authorize/', body: consent});

    act(() => result.current.actions.retry());

    await waitFor(() =>
      expect(result.current.state).toMatchObject({status: 'consent', consent})
    );
  });
});
