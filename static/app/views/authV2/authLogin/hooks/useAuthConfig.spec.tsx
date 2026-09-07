import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {AuthConfig} from 'sentry/types/auth';

import {useAuthConfig} from './useAuthConfig';

describe('useAuthConfig', () => {
  it('fetches the authentication configuration', async () => {
    const response: AuthConfig = {
      canRegister: true,
      hasNewsletter: false,
      pendingMfa: null,
      serverHostname: 'sentry.example.com',
    };
    const request = MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: response,
    });

    const {result} = renderHookWithProviders(useAuthConfig);

    await waitFor(() => expect(result.current.data).toEqual(response));
    expect(request).toHaveBeenCalledTimes(1);
  });
});
