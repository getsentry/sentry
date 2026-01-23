import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useGetActiveIntegratedOrgs} from './useGetActiveIntegratedOrgs';

describe('useGetActiveIntegratedOrgs', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('fetches repository data successfully', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});
    const mockIntegrations = [
      {
        id: '123',
        name: 'github-org-name',
        domainName: 'github.com/github-org-name',
        provider: {
          key: 'github',
          name: 'GitHub',
        },
        externalId: '88888888',
        status: 'active',
      },
    ];

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: mockIntegrations,
    });

    const {result} = renderHookWithProviders(useGetActiveIntegratedOrgs, {
      organization,
      initialProps: {organization},
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockIntegrations);
    expect(result.current.data?.[0]?.id).toBe('123');
    expect(result.current.data?.[0]?.name).toBe('github-org-name');
    expect(result.current.data?.[0]?.status).toBe('active');
  });

  it('filters out inactive integrated orgs', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});
    const mockIntegrations = [
      {
        id: '123',
        name: 'github-org-name',
        status: 'inactive',
      },
      {
        id: '456',
        name: 'github-org-name-2',
        status: 'inactive',
      },
      {
        id: '789',
        name: 'github-org-name-3',
        status: 'active',
      },
    ];

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: mockIntegrations,
    });

    const {result} = renderHookWithProviders(useGetActiveIntegratedOrgs, {
      organization,
      initialProps: {organization},
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([mockIntegrations[2]]);
  });

  it('handles API errors gracefully', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      statusCode: 404,
      body: {detail: 'Repository not found'},
    });

    const {result} = renderHookWithProviders(useGetActiveIntegratedOrgs, {
      organization,
      initialProps: {organization},
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.data).toBeUndefined();
  });
});
