import {UserFixture} from 'sentry-fixture/user';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  useSecondFactorAuth,
  useSecondFactorChallenge,
  useSecondFactorMethods,
  useCancelSecondFactorAuth,
} from './useSecondFactorAuth';

describe('useSecondFactorMethods', () => {
  it('fetches the available authentication methods when enabled', async () => {
    const response = {
      mfaRequired: true as const,
      mfaMethods: [{id: 'totp' as const}, {id: 'recovery' as const}],
    };
    const request = MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      body: response,
    });

    const {result} = renderHookWithProviders(() => useSecondFactorMethods(true));

    await waitFor(() => expect(result.current.data).toEqual(response));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not fetch the available authentication methods when disabled', () => {
    const request = MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      body: {mfaRequired: true, mfaMethods: [{id: 'totp'}]},
    });

    const {result} = renderHookWithProviders(() => useSecondFactorMethods(false));

    expect(result.current.fetchStatus).toBe('idle');
    expect(request).not.toHaveBeenCalled();
  });
});

describe('useCancelSecondFactorAuth', () => {
  it('cancels the pending authentication', async () => {
    const cancelRequest = MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'DELETE',
      statusCode: 204,
    });
    const {result} = renderHookWithProviders(useCancelSecondFactorAuth);

    act(() => result.current.cancel());

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(cancelRequest).toHaveBeenCalledWith(
      '/auth/2fa/',
      expect.objectContaining({method: 'DELETE'})
    );
  });
});

describe('useSecondFactorChallenge', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records when an SMS challenge was activated', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_234_567);
    const request = MockApiClient.addMockResponse({
      url: '/auth/2fa/challenge/',
      method: 'POST',
      body: {method: 'sms', expiresIn: 45},
    });
    const {result} = renderHookWithProviders(useSecondFactorChallenge);

    act(() => result.current.activate('sms'));

    await waitFor(() =>
      expect(result.current.result).toEqual({
        method: 'sms',
        expiresIn: 45,
        activatedAt: 1_234_567,
      })
    );
    expect(request).toHaveBeenCalledWith(
      '/auth/2fa/challenge/',
      expect.objectContaining({method: 'POST', data: {method: 'sms'}})
    );
  });

  it('preserves a WebAuthn challenge response', async () => {
    const response = {
      method: 'u2f' as const,
      challenge: {webAuthnAuthenticationData: 'challenge-data'},
    };
    MockApiClient.addMockResponse({
      url: '/auth/2fa/challenge/',
      method: 'POST',
      body: response,
    });
    const {result} = renderHookWithProviders(useSecondFactorChallenge);

    act(() => result.current.activate('u2f'));

    await waitFor(() => expect(result.current.result).toEqual(response));
  });
});

describe('useSecondFactorAuth', () => {
  it('submits the authentication response', async () => {
    const response = {nextUri: '/organizations/', user: UserFixture()};
    const request = MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'POST',
      body: response,
    });
    const {result} = renderHookWithProviders(useSecondFactorAuth);

    act(() => result.current.authenticate({method: 'totp', otp: '123456'}));

    await waitFor(() => expect(result.current.result).toEqual(response));
    expect(request).toHaveBeenCalledWith(
      '/auth/2fa/',
      expect.objectContaining({
        method: 'POST',
        data: {method: 'totp', otp: '123456'},
      })
    );
  });

  it('submits a WebAuthn authentication response', async () => {
    const response = {nextUri: '/organizations/', user: UserFixture()};
    const request = MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'POST',
      body: response,
    });
    const {result} = renderHookWithProviders(useSecondFactorAuth);
    const webAuthnResponse = {
      authenticatorData: 'authenticator-data',
      clientData: 'client-data',
      keyHandle: 'key-handle',
      signatureData: 'signature-data',
    };

    act(() => result.current.authenticate({method: 'u2f', response: webAuthnResponse}));

    await waitFor(() => expect(result.current.result).toEqual(response));
    expect(request).toHaveBeenCalledWith(
      '/auth/2fa/',
      expect.objectContaining({
        method: 'POST',
        data: {method: 'u2f', response: webAuthnResponse},
      })
    );
  });

  it('returns an authentication error', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'POST',
      statusCode: 400,
      body: {detail: 'Invalid authentication code'},
    });
    const {result} = renderHookWithProviders(useSecondFactorAuth);

    act(() => result.current.authenticate({method: 'totp', otp: 'incorrect'}));

    await waitFor(() =>
      expect(result.current.errorMessage).toBe('Invalid authentication code')
    );
    expect(result.current.result).toBeNull();
  });
});
