import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useAuthOrganization} from './useAuthOrganization';

describe('useAuthOrganization', () => {
  it('fetches the organization authentication configuration', async () => {
    const response = {
      authenticated: false,
      memberAuthenticated: false,
      canRegister: false,
      joinRequestUrl: '/join-request/acme/',
      loginMethod: 'sso' as const,
      ssoRequired: true,
      organization: {
        avatarUrl: null,
        name: 'Acme',
        slug: 'acme',
      },
      provider: {
        key: 'dummy',
        name: 'Dummy',
      },
      warnings: [],
    };
    const request = MockApiClient.addMockResponse({
      url: '/auth/organizations/acme/config/',
      body: response,
    });

    const {result} = renderHookWithProviders(() => useAuthOrganization('acme'));

    await waitFor(() => expect(result.current.data).toEqual(response));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not fetch without an organization slug', () => {
    const {result} = renderHookWithProviders(() => useAuthOrganization());

    expect(result.current.fetchStatus).toBe('idle');
  });
});
