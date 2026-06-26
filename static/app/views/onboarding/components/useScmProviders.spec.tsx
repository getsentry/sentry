import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OpsgenieIntegrationProviderFixture} from 'sentry-fixture/opsgenieIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useScmProviders} from './useScmProviders';

describe('useScmProviders', () => {
  const organization = OrganizationFixture();

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('filters providers by commits feature gate', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {
        providers: [
          GitHubIntegrationProviderFixture(),
          OpsgenieIntegrationProviderFixture(),
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [],
    });

    const {result} = renderHookWithProviders(() => useScmProviders(), {organization});

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.scmProviders).toHaveLength(1);
    expect(result.current.scmProviders[0]!.key).toBe('github');
  });

  it('orders providers with the primary providers first', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {
        providers: [
          GitHubIntegrationProviderFixture({
            key: 'vsts',
            slug: 'vsts',
            name: 'Azure DevOps',
          }),
          GitHubIntegrationProviderFixture({
            key: 'bitbucket',
            slug: 'bitbucket',
            name: 'Bitbucket',
          }),
          GitHubIntegrationProviderFixture({
            key: 'github',
            slug: 'github',
            name: 'GitHub',
          }),
          GitHubIntegrationProviderFixture({
            key: 'gitlab',
            slug: 'gitlab',
            name: 'GitLab',
          }),
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [],
    });

    const {result} = renderHookWithProviders(() => useScmProviders(), {organization});

    await waitFor(() => expect(result.current.isPending).toBe(false));

    // Primary providers come first in PRIMARY_PROVIDER_KEYS order, then the
    // rest in their original order -- matching ScmProviderPills.
    expect(result.current.scmProviders.map(p => p.key)).toEqual([
      'github',
      'gitlab',
      'bitbucket',
      'vsts',
    ]);
  });

  it('returns first active integration as activeIntegrationExisting', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {providers: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [
        OrganizationIntegrationsFixture({
          id: '1',
          name: 'getsentry',
          provider: {
            key: 'github',
            slug: 'github',
            name: 'GitHub',
            canAdd: true,
            canDisable: false,
            features: ['commits'],
            aspects: {},
          },
        }),
      ],
    });

    const {result} = renderHookWithProviders(() => useScmProviders(), {organization});

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.activeIntegrationExisting).not.toBeNull();
    expect(result.current.activeIntegrationExisting!.id).toBe('1');
  });

  it('returns every active integration in activeIntegrations', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {providers: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [
        OrganizationIntegrationsFixture({
          id: '1',
          name: 'getsentry',
          provider: {
            key: 'github',
            slug: 'github',
            name: 'GitHub',
            canAdd: true,
            canDisable: false,
            features: ['commits'],
            aspects: {},
          },
        }),
        OrganizationIntegrationsFixture({
          id: '2',
          name: 'acme',
          provider: {
            key: 'gitlab',
            slug: 'gitlab',
            name: 'GitLab',
            canAdd: true,
            canDisable: false,
            features: ['commits'],
            aspects: {},
          },
        }),
        OrganizationIntegrationsFixture({
          id: '3',
          name: 'disabled-org',
          status: 'disabled',
          provider: {
            key: 'github',
            slug: 'github',
            name: 'GitHub',
            canAdd: true,
            canDisable: false,
            features: ['commits'],
            aspects: {},
          },
        }),
      ],
    });

    const {result} = renderHookWithProviders(() => useScmProviders(), {organization});

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.activeIntegrations.map(i => i.id)).toEqual(['1', '2']);
    expect(result.current.activeIntegrationExisting!.id).toBe('1');
  });

  it('orders activeIntegrations by provider, prioritizing the primary choice', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {providers: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [
        OrganizationIntegrationsFixture({
          id: '1',
          name: 'acme',
          provider: {
            key: 'gitlab',
            slug: 'gitlab',
            name: 'GitLab',
            canAdd: true,
            canDisable: false,
            features: ['commits'],
            aspects: {},
          },
        }),
        OrganizationIntegrationsFixture({
          id: '2',
          name: 'getsentry',
          provider: {
            key: 'github',
            slug: 'github',
            name: 'GitHub',
            canAdd: true,
            canDisable: false,
            features: ['commits'],
            aspects: {},
          },
        }),
        OrganizationIntegrationsFixture({
          id: '3',
          name: 'bb',
          provider: {
            key: 'bitbucket',
            slug: 'bitbucket',
            name: 'Bitbucket',
            canAdd: true,
            canDisable: false,
            features: ['commits'],
            aspects: {},
          },
        }),
      ],
    });

    const {result} = renderHookWithProviders(() => useScmProviders(), {organization});

    await waitFor(() => expect(result.current.isPending).toBe(false));

    // Input order gitlab, github, bitbucket -> github, gitlab, bitbucket, so
    // activeIntegrationExisting is the github integration.
    expect(result.current.activeIntegrations.map(i => i.id)).toEqual(['2', '1', '3']);
    expect(result.current.activeIntegrationExisting!.id).toBe('2');
  });

  it('keeps two integrations of the same provider in their original order', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {providers: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [
        OrganizationIntegrationsFixture({
          id: '2',
          name: 'acme',
          provider: {
            key: 'github',
            slug: 'github',
            name: 'GitHub',
            canAdd: true,
            canDisable: false,
            features: ['commits'],
            aspects: {},
          },
        }),
        OrganizationIntegrationsFixture({
          id: '1',
          name: 'getsentry',
          provider: {
            key: 'github',
            slug: 'github',
            name: 'GitHub',
            canAdd: true,
            canDisable: false,
            features: ['commits'],
            aspects: {},
          },
        }),
      ],
    });

    const {result} = renderHookWithProviders(() => useScmProviders(), {organization});

    await waitFor(() => expect(result.current.isPending).toBe(false));

    // Both are GitHub, so the stable sort leaves them in input order and
    // activeIntegrationExisting stays the first one.
    expect(result.current.activeIntegrations.map(i => i.id)).toEqual(['2', '1']);
    expect(result.current.activeIntegrationExisting!.id).toBe('2');
  });

  it('excludes non-active integrations from activeIntegrationExisting', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {providers: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [
        OrganizationIntegrationsFixture({
          id: '1',
          name: 'getsentry',
          status: 'disabled',
          provider: {
            key: 'github',
            slug: 'github',
            name: 'GitHub',
            canAdd: true,
            canDisable: false,
            features: ['commits'],
            aspects: {},
          },
        }),
        OrganizationIntegrationsFixture({
          id: '2',
          name: 'other',
          status: 'active',
          organizationIntegrationStatus: 'pending_deletion',
          provider: {
            key: 'gitlab',
            slug: 'gitlab',
            name: 'GitLab',
            canAdd: true,
            canDisable: false,
            features: ['commits'],
            aspects: {},
          },
        }),
      ],
    });

    const {result} = renderHookWithProviders(() => useScmProviders(), {organization});

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.activeIntegrationExisting).toBeNull();
  });

  it('passes integrationType=source_code_management to integrations endpoint', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {providers: []},
    });
    const integrationsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [],
    });

    renderHookWithProviders(() => useScmProviders(), {organization});

    await waitFor(() => expect(integrationsRequest).toHaveBeenCalled());

    expect(integrationsRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          integrationType: 'source_code_management',
        }),
      })
    );
  });
});
