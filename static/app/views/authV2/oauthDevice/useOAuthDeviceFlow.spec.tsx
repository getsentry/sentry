import {OAuthContextFixture} from 'sentry-fixture/oauth';
import {UserFixture} from 'sentry-fixture/user';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import type {AuthConfig} from 'sentry/types/auth';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

import {useOAuthDeviceFlow} from './useOAuthDeviceFlow';

const location = {pathname: '/oauth/device/', query: {user_code: 'ABCD-EFGH'}};
const consent = {stage: 'consent', userCode: 'ABCD-EFGH', organizationOptions: []};
const loginConfig: AuthConfig = {
  pendingMfa: null,
  serverHostname: 'sentry.example.com',
  canRegister: false,
  hasNewsletter: false,
};

describe('useOAuthDeviceFlow', () => {
  const originalConfig = ConfigStore.getState();

  beforeEach(() => {
    ConfigStore.set('user', UserFixture());
    MockApiClient.addMockResponse({
      url: '/auth/oauth/device/context/',
      body: {...OAuthContextFixture(), userCode: 'ABCD-EFGH'},
    });
    MockApiClient.addMockResponse({url: '/auth/oauth/device/', body: consent});
  });

  afterEach(() => ConfigStore.loadInitialData(originalConfig));

  it('keeps code entry visible until normalized context and consent settle without navigating', async () => {
    const delay = Promise.withResolvers<void>();
    const prepare = MockApiClient.addMockResponse({
      url: '/auth/oauth/device/',
      body: consent,
      asyncDelay: delay.promise,
    });
    const {result, router} = renderHookWithProviders(useOAuthDeviceFlow, {
      initialRouterConfig: {location: {pathname: location.pathname}},
    });
    expect(result.current.state).toMatchObject({
      status: 'code-entry',
      userCode: '',
      isPreparingCode: false,
    });
    expect(prepare).not.toHaveBeenCalled();

    act(() => result.current.actions.enterCode('ABCDEFGH'));

    await waitFor(() =>
      expect(prepare).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({query: {user_code: 'ABCD-EFGH'}})
      )
    );
    expect(result.current.state).toMatchObject({
      status: 'code-entry',
      isPreparingCode: true,
      context: undefined,
    });
    expect(router.location.query).toEqual({});

    await act(() => {
      delay.resolve();
      return delay.promise;
    });

    await waitFor(() =>
      expect(result.current.state).toMatchObject({status: 'consent', consent})
    );
    expect(result.current.state.returnTo).toBe('/oauth/device/?user_code=ABCDEFGH');
    expect(router.location.query).toEqual({});
  });

  it.each(['context', 'preparation', 'decision'])(
    'allows editing a code that expires during %s without changing the URL',
    async phase => {
      const expireCode = () =>
        MockApiClient.addMockResponse({
          url: '/auth/oauth/device/context/',
          statusCode: 400,
          body: {detail: 'Invalid or expired code.'},
        });
      const prepare =
        phase === 'preparation'
          ? MockApiClient.addMockResponse({
              url: '/auth/oauth/device/',
              statusCode: 400,
              body: () => {
                expireCode();
                return {detail: 'Invalid or expired code.'};
              },
            })
          : undefined;
      const {result, router} = renderHookWithProviders(useOAuthDeviceFlow, {
        initialRouterConfig: {location},
      });

      if (prepare) {
        await waitFor(() => expect(prepare).toHaveBeenCalled());
      } else {
        await waitFor(() => expect(result.current.state.status).toBe('consent'));
        expireCode();

        if (phase === 'decision') {
          MockApiClient.addMockResponse({
            url: '/auth/oauth/device/',
            method: 'POST',
            statusCode: 400,
            body: {detail: 'Invalid or expired code.'},
          });
          act(() => result.current.actions.decide('approve'));
        } else {
          act(() => result.current.actions.retry());
        }
      }

      await waitFor(() =>
        expect(result.current.state).toMatchObject({
          status: 'code-entry',
          isPreparingCode: false,
          message: 'Invalid or expired code.',
        })
      );

      const retry = MockApiClient.addMockResponse({
        url: '/auth/oauth/device/context/',
        body: {...OAuthContextFixture(), userCode: 'ABCD-EFGH'},
      });
      MockApiClient.addMockResponse({url: '/auth/oauth/device/', body: consent});

      act(() => result.current.actions.enterCode('ABCD-EFGH'));

      await waitFor(() => expect(result.current.state.status).toBe('consent'));
      expect(retry).toHaveBeenCalledTimes(1);
      expect(router.location.query).toEqual(location.query);
    }
  );

  it.each([null, {mfaRequired: true, mfaMethods: [{id: 'totp' as const}]}])(
    'uses auth configuration to resolve a consent 403 with pending MFA %j',
    async pendingMfa => {
      const config = {...loginConfig, pendingMfa};
      MockApiClient.addMockResponse({
        url: '/auth/oauth/device/',
        statusCode: 403,
        body: {detail: 'Authentication required.'},
      });
      const delay = Promise.withResolvers<void>();
      const auth = MockApiClient.addMockResponse({
        url: '/auth/config/',
        body: config,
        asyncDelay: delay.promise,
      });
      const {result} = renderHookWithProviders(useOAuthDeviceFlow, {
        initialRouterConfig: {location},
      });

      await waitFor(() => expect(auth).toHaveBeenCalled());
      expect(result.current.state).toMatchObject({
        status: 'code-entry',
        isPreparingCode: true,
      });

      await act(() => {
        delay.resolve();
        return delay.promise;
      });

      await waitFor(() =>
        expect(result.current.state).toMatchObject({
          status: 'authentication',
          authConfig: config,
          isPreparingConsent: false,
        })
      );
      expect(auth).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({query: {next: '/oauth/device/?user_code=ABCD-EFGH'}})
      );
    }
  );

  it('surfaces a consent access denial for an already authenticated account', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/oauth/device/',
      statusCode: 403,
      body: {detail: 'No eligible organization.'},
    });
    MockApiClient.addMockResponse({url: '/auth/config/', body: {nextUri: '/home/'}});
    const {result} = renderHookWithProviders(useOAuthDeviceFlow, {
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

  it('keeps completed login pending until fresh device consent is ready', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/oauth/device/',
      statusCode: 403,
      body: {detail: 'Authentication required.'},
    });
    MockApiClient.addMockResponse({url: '/auth/config/', body: loginConfig});
    const {result} = renderHookWithProviders(useOAuthDeviceFlow, {
      initialRouterConfig: {location},
    });

    await waitFor(() => expect(result.current.state.status).toBe('authentication'));

    const delay = Promise.withResolvers<void>();
    MockApiClient.addMockResponse({
      url: '/auth/oauth/device/',
      body: consent,
      asyncDelay: delay.promise,
    });
    const user = UserFixture({id: '2'});

    act(() =>
      result.current.actions.onAuthenticated({user, nextUri: '/home/'}, loginConfig)
    );

    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: 'authentication',
        isPreparingConsent: true,
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

  it.each([
    {op: 'approve' as const, outcome: 'approved'},
    {op: 'deny' as const, outcome: 'denied'},
  ])(
    'requires an explicit $op decision and completes in place',
    async ({op, outcome}) => {
      const decide = MockApiClient.addMockResponse({
        url: '/auth/oauth/device/',
        method: 'POST',
        body: {stage: outcome},
      });
      const {result} = renderHookWithProviders(useOAuthDeviceFlow, {
        initialRouterConfig: {location},
      });

      await waitFor(() => expect(result.current.state.status).toBe('consent'));
      expect(decide).not.toHaveBeenCalled();

      act(() => result.current.actions.decide(op, 'selected-org'));

      await waitFor(() =>
        expect(result.current.state).toMatchObject({status: 'complete', outcome})
      );
      expect(decide).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {op, userCode: 'ABCD-EFGH', selectedOrganizationId: 'selected-org'},
        })
      );
      expect(testableWindowLocation.assign).not.toHaveBeenCalled();
    }
  );

  it('prepares consent for a new account after a failed decision', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/oauth/device/',
      method: 'POST',
      statusCode: 503,
      body: {detail: 'Approval unavailable.'},
    });
    MockApiClient.addMockResponse({url: '/auth/', method: 'DELETE', body: {}});
    MockApiClient.addMockResponse({url: '/auth-v2/csrf/', body: {}});
    MockApiClient.addMockResponse({url: '/auth/config/', body: loginConfig});
    const {result} = renderHookWithProviders(useOAuthDeviceFlow, {
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

    const prepared = {
      ...consent,
      organizationOptions: [{id: '1', name: 'Example Org', slug: 'org-slug'}],
    };
    const user = UserFixture({id: '2'});
    MockApiClient.addMockResponse({url: '/auth/oauth/device/', body: prepared});

    act(() => {
      result.current.actions.onAuthenticated({user, nextUri: '/home/'}, loginConfig);
    });

    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: 'consent',
        consent: prepared,
        user,
      })
    );
  });

  it.each(['enterCode', 'retry'] as const)(
    'shows code preparation while %s retries a failed context request',
    async action => {
      MockApiClient.addMockResponse({
        url: '/auth/oauth/device/context/',
        statusCode: 400,
        body: {detail: 'Invalid or expired code.'},
      });
      const {result} = renderHookWithProviders(useOAuthDeviceFlow, {
        initialRouterConfig: {location},
      });

      await waitFor(() =>
        expect(result.current.state).toMatchObject({message: 'Invalid or expired code.'})
      );

      const delay = Promise.withResolvers<void>();
      MockApiClient.addMockResponse({
        url: '/auth/oauth/device/context/',
        body: {...OAuthContextFixture(), userCode: 'ABCD-EFGH'},
        asyncDelay: delay.promise,
      });

      act(() => result.current.actions[action]('ABCD-EFGH'));

      await waitFor(() =>
        expect(result.current.state).toMatchObject({
          status: 'code-entry',
          isPreparingCode: true,
        })
      );

      await act(() => {
        delay.resolve();
        return delay.promise;
      });

      await waitFor(() => expect(result.current.state.status).toBe('consent'));
    }
  );

  it('prepares fresh consent after a rejected decision with a valid code', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/oauth/device/',
      method: 'POST',
      statusCode: 400,
      body: {detail: 'Please start over.'},
    });
    const {result} = renderHookWithProviders(useOAuthDeviceFlow, {
      initialRouterConfig: {location},
    });

    await waitFor(() => expect(result.current.state.status).toBe('consent'));

    act(() => result.current.actions.decide('approve'));

    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: 'error',
        canRetry: true,
        message: 'Please start over.',
      })
    );

    const prepare = MockApiClient.addMockResponse({
      url: '/auth/oauth/device/',
      body: consent,
    });

    act(() => result.current.actions.retry());

    await waitFor(() =>
      expect(result.current.state).toMatchObject({status: 'consent', consent})
    );
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('retries a transient consent failure without asking for the code again', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/oauth/device/',
      statusCode: 503,
      body: {detail: 'Temporarily unavailable.'},
    });
    const {result} = renderHookWithProviders(useOAuthDeviceFlow, {
      initialRouterConfig: {location},
    });

    await waitFor(() =>
      expect(result.current.state).toMatchObject({status: 'error', canRetry: true})
    );

    const prepare = MockApiClient.addMockResponse({
      url: '/auth/oauth/device/',
      body: consent,
    });

    act(() => result.current.actions.retry());

    await waitFor(() =>
      expect(result.current.state).toMatchObject({status: 'consent', consent})
    );
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('blocks old-account decisions during switching and after logout', async () => {
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
      url: '/auth/oauth/device/',
      method: 'POST',
      body: {},
    });
    const {result} = renderHookWithProviders(useOAuthDeviceFlow, {
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
});
