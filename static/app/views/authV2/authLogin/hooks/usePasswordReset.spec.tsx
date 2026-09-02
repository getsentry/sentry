import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {usePasswordReset} from './usePasswordReset';

describe('usePasswordReset', () => {
  it('requests a recovery email from the recovery API', async () => {
    const detail = 'If an eligible account exists, a recovery email has been sent.';
    const request = MockApiClient.addMockResponse({
      url: '/auth/recovery/',
      method: 'POST',
      statusCode: 202,
      body: {detail},
    });
    const {result} = renderHookWithProviders(usePasswordReset);

    act(() => {
      result.current.requestPasswordReset('user@example.com');
    });

    await waitFor(() =>
      expect(result.current.result).toEqual({status: 'accepted', message: detail})
    );
    expect(request).toHaveBeenCalledWith(
      '/auth/recovery/',
      expect.objectContaining({
        method: 'POST',
        data: {user: 'user@example.com'},
      })
    );
  });

  it('returns the recovery API error', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/recovery/',
      method: 'POST',
      statusCode: 429,
      body: {detail: 'Too many password recovery attempts'},
    });
    const {result} = renderHookWithProviders(usePasswordReset);

    act(() => {
      result.current.requestPasswordReset('user@example.com');
    });

    await waitFor(() =>
      expect(result.current.errorMessage).toBe('Too many password recovery attempts')
    );
    expect(result.current.result).toBeNull();
  });

  it('clears an accepted result after a later recovery error', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/recovery/',
      method: 'POST',
      statusCode: 202,
      body: {detail: 'Recovery requested'},
    });
    const {result} = renderHookWithProviders(usePasswordReset);

    act(() => {
      result.current.requestPasswordReset('user@example.com');
    });
    await waitFor(() => expect(result.current.result).not.toBeNull());

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/auth/recovery/',
      method: 'POST',
      statusCode: 429,
      body: {detail: 'Too many password recovery attempts'},
    });
    act(() => {
      result.current.requestPasswordReset('user@example.com');
    });

    await waitFor(() => expect(result.current.errorMessage).not.toBeNull());
    expect(result.current.result).toBeNull();
  });
});
