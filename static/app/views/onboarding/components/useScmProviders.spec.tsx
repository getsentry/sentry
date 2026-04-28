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
