import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {OrganizationIntegration} from 'sentry/types/integrations';

import {usePreventAIOrgs} from './usePreventAIOrgRepos';

describe('usePreventAIOrgRepos', () => {
  const mockOrg = OrganizationFixture();

  const mockResponse: OrganizationIntegration[] = [
    OrganizationIntegrationsFixture({
      id: '1',
      name: 'repo1',
      externalId: 'ext-1',
    }),
    OrganizationIntegrationsFixture({
      id: '2',
      name: 'repo2',
      externalId: 'ext-2',
    }),
  ];

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('returns data on success', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrg.slug}/integrations/`,
      body: mockResponse,
    });

    const {result} = renderHookWithProviders(() => usePreventAIOrgs(), {
      organization: mockOrg,
    });

    await waitFor(() => expect(result.current.data).toEqual(mockResponse));
    expect(result.current.isError).toBe(false);
    expect(result.current.isPending).toBe(false);
  });

  it('returns error on failure', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrg.slug}/integrations/`,
      statusCode: 500,
      body: {error: 'Internal Server Error'},
    });

    const {result} = renderHookWithProviders(() => usePreventAIOrgs(), {
      organization: mockOrg,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('refetches data', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrg.slug}/integrations/`,
      body: mockResponse,
    });

    const {result} = renderHookWithProviders(() => usePreventAIOrgs(), {
      organization: mockOrg,
    });

    await waitFor(() => expect(result.current.data).toEqual(mockResponse));

    const newResponse: OrganizationIntegration[] = [
      OrganizationIntegrationsFixture({
        id: '3',
        name: 'repo3',
        externalId: 'ext-3',
      }),
    ];
    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrg.slug}/integrations/`,
      body: newResponse,
    });

    result.current.refetch();
    await waitFor(() => expect(result.current.data?.[0]?.name).toBe('repo3'));
    expect(result.current.data).toEqual(newResponse);
  });
});
