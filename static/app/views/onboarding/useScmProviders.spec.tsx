import {OrganizationFixture} from 'sentry-fixture/organization';

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
          {
            key: 'github',
            name: 'GitHub',
            metadata: {features: [{featureGate: 'integrations-commits'}]},
          },
          {
            key: 'slack',
            name: 'Slack',
            metadata: {features: [{featureGate: 'integrations-chat-unfurl'}]},
          },
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
        {
          id: '1',
          name: 'getsentry',
          status: 'active',
          organizationIntegrationStatus: 'active',
          provider: {key: 'github', name: 'GitHub'},
        },
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
        {
          id: '1',
          name: 'getsentry',
          status: 'disabled',
          organizationIntegrationStatus: 'active',
          provider: {key: 'github', name: 'GitHub'},
        },
        {
          id: '2',
          name: 'other',
          status: 'active',
          organizationIntegrationStatus: 'pending_deletion',
          provider: {key: 'gitlab', name: 'GitLab'},
        },
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
