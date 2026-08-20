import {UserFixture} from 'sentry-fixture/user';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useEmailAuth} from './useEmailAuth';

describe('useEmailAuth', () => {
  it('authenticates with the login API', async () => {
    const user = UserFixture();
    const request = MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      body: {nextUri: '/organizations/', user},
    });
    const {result} = renderHookWithProviders(useEmailAuth);

    act(() => {
      result.current.authenticate({email: 'user@example.com', password: 'secret'});
    });

    await waitFor(() =>
      expect(result.current.result).toEqual({
        status: 'authenticated',
        nextUri: '/organizations/',
        user,
      })
    );
    expect(request).toHaveBeenCalledWith(
      '/auth/login/',
      expect.objectContaining({
        method: 'POST',
        data: {username: 'user@example.com', password: 'secret', orgSlug: null},
      })
    );
  });

  it('includes organization context when authenticating', async () => {
    const user = UserFixture();
    const request = MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      body: {nextUri: '/organizations/acme/issues/', user},
    });
    const {result} = renderHookWithProviders(() => useEmailAuth('acme'));

    act(() => {
      result.current.authenticate({email: 'user@example.com', password: 'secret'});
    });

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/auth/login/',
        expect.objectContaining({
          method: 'POST',
          data: {username: 'user@example.com', password: 'secret', orgSlug: 'acme'},
        })
      )
    );
  });

  it('returns the available MFA methods', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      statusCode: 202,
      body: {
        mfaRequired: true,
        mfaMethods: [{id: 'totp'}, {id: 'recovery'}],
      },
    });
    const {result} = renderHookWithProviders(useEmailAuth);

    act(() => {
      result.current.authenticate({email: 'user@example.com', password: 'secret'});
    });

    await waitFor(() =>
      expect(result.current.result).toEqual({
        status: 'mfa-required',
        methods: [{id: 'totp'}, {id: 'recovery'}],
      })
    );
  });

  it('returns the login form error', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      statusCode: 400,
      body: {
        detail: 'Login attempt failed',
        errors: {__all__: ['Invalid email or password']},
      },
    });
    const {result} = renderHookWithProviders(useEmailAuth);

    act(() => {
      result.current.authenticate({email: 'user@example.com', password: 'wrong'});
    });

    await waitFor(() =>
      expect(result.current.errorMessage).toBe('Invalid email or password')
    );
    expect(result.current.result).toBeNull();
  });

  it('clears a successful result after a later login error', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      body: {nextUri: '/organizations/', user: UserFixture()},
    });
    const {result} = renderHookWithProviders(useEmailAuth);

    act(() => {
      result.current.authenticate({email: 'user@example.com', password: 'secret'});
    });
    await waitFor(() => expect(result.current.result).not.toBeNull());

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      statusCode: 400,
      body: {errors: {__all__: ['Invalid email or password']}},
    });
    act(() => {
      result.current.authenticate({email: 'user@example.com', password: 'wrong'});
    });

    await waitFor(() => expect(result.current.errorMessage).not.toBeNull());
    expect(result.current.result).toBeNull();
  });
});
