import {OrganizationFixture} from 'sentry-fixture/organization';
import {PreventAIConfigFixture} from 'sentry-fixture/prevent';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {OrganizationIntegration} from 'sentry/types/integrations';

import {usePreventAIOrgs} from './usePreventAIOrgRepos';

describe('usePreventAIOrgRepos', () => {
  const mockOrg = OrganizationFixture({
    preventAiConfigGithub: PreventAIConfigFixture(),
  });

  const mockResponse: OrganizationIntegration[] = [
    {
      id: '1',
      name: 'repo1',
      externalId: 'ext-1',
      provider: {
        key: 'github',
        name: 'GitHub',
        slug: 'github',
        aspects: {},
        canAdd: true,
        canDisable: false,
        features: [],
      },
      organizationId: '1',
      status: 'active',
      domainName: null,
      accountType: null,
      configData: null,
      configOrganization: [],
      gracePeriodEnd: null,
      icon: null,
      organizationIntegrationStatus: 'active',
    },
    {
      id: '2',
      name: 'repo2',
      externalId: 'ext-2',
      provider: {
        key: 'github',
        name: 'GitHub',
        slug: 'github',
        aspects: {},
        canAdd: true,
        canDisable: false,
        features: [],
      },
      organizationId: '1',
      status: 'active',
      domainName: null,
      accountType: null,
      configData: null,
      configOrganization: [],
      gracePeriodEnd: null,
      icon: null,
      organizationIntegrationStatus: 'active',
    },
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
      {
        id: '3',
        name: 'repo3',
        externalId: 'ext-3',
        provider: {
          key: 'github',
          name: 'GitHub',
          slug: 'github',
          aspects: {},
          canAdd: true,
          canDisable: false,
          features: [],
        },
        organizationId: '1',
        status: 'active',
        domainName: null,
        accountType: null,
        configData: null,
        configOrganization: [],
        gracePeriodEnd: null,
        icon: null,
        organizationIntegrationStatus: 'active',
      },
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
