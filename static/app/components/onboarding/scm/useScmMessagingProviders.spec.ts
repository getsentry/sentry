import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {
  act,
  cleanup,
  renderHookWithProviders,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {useScmMessagingProviders} from 'sentry/components/onboarding/scm/useScmMessagingProviders';
import type {OrganizationIntegration} from 'sentry/types/integrations';

const organization = OrganizationFixture();

function mockProviders() {
  ['slack', 'discord', 'msteams'].forEach(key => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {providers: [GitHubIntegrationProviderFixture({key})]},
      match: [MockApiClient.matchQuery({provider_key: key})],
    });
  });
}

function mockIntegrations(bodies: OrganizationIntegration[]) {
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/integrations/`,
    body: bodies,
    match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
  });
}

function renderProviders() {
  return renderHookWithProviders(() => useScmMessagingProviders(), {organization});
}

describe('useScmMessagingProviders', () => {
  afterEach(() => {
    cleanup();
    MockApiClient.clearMockResponses();
  });

  it('returns one installable row per provider when no integrations are connected', async () => {
    mockProviders();
    mockIntegrations([]);

    const {result} = renderProviders();

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.providers).toHaveLength(3);
    expect(result.current.providers.map(p => p.providerKey)).toEqual([
      'slack',
      'discord',
      'msteams',
    ]);
    result.current.providers.forEach(p => expect(p.status).toBe('installable'));
  });

  it('marks a provider connected when it has an active integration', async () => {
    mockProviders();
    mockIntegrations([
      OrganizationIntegrationsFixture({
        id: '10',
        status: 'active',
        organizationIntegrationStatus: 'active',
      }),
    ]);

    const {result} = renderProviders();

    await waitFor(() => expect(result.current.isPending).toBe(false));

    const slack = result.current.providers.find(p => p.providerKey === 'slack');
    expect(slack?.status).toBe('connected');
    expect(slack?.eligibleIntegrations).toHaveLength(1);
    expect(slack?.eligibleIntegrations[0]?.id).toBe('10');
    expect(slack?.permissionLimitedIntegration).toBeUndefined();

    result.current.providers
      .filter(p => p.providerKey !== 'slack')
      .forEach(p => expect(p.status).toBe('installable'));
  });

  it('ignores inactive integrations and leaves the provider installable', async () => {
    mockProviders();
    mockIntegrations([
      OrganizationIntegrationsFixture({
        id: '11',
        provider: {...OrganizationIntegrationsFixture().provider, key: 'discord'},
        status: 'disabled',
        organizationIntegrationStatus: 'active',
      }),
    ]);

    const {result} = renderProviders();

    await waitFor(() => expect(result.current.isPending).toBe(false));

    const discord = result.current.providers.find(p => p.providerKey === 'discord');
    expect(discord?.status).toBe('installable');
  });

  it('marks a tenant-type msteams integration as permission-limited', async () => {
    mockProviders();
    mockIntegrations([
      OrganizationIntegrationsFixture({
        id: '12',
        provider: {...OrganizationIntegrationsFixture().provider, key: 'msteams'},
        status: 'active',
        organizationIntegrationStatus: 'active',
        configData: {installationType: 'tenant'},
      }),
    ]);

    const {result} = renderProviders();

    await waitFor(() => expect(result.current.isPending).toBe(false));

    const msteams = result.current.providers.find(p => p.providerKey === 'msteams');
    expect(msteams?.status).toBe('permission-limited');
    expect(msteams?.eligibleIntegrations).toHaveLength(0);
    // The tenant integration is surfaced for workspace-name display.
    expect(msteams?.permissionLimitedIntegration?.id).toBe('12');
  });

  it('marks a team-type msteams integration as connected', async () => {
    mockProviders();
    mockIntegrations([
      OrganizationIntegrationsFixture({
        id: '13',
        provider: {...OrganizationIntegrationsFixture().provider, key: 'msteams'},
        status: 'active',
        organizationIntegrationStatus: 'active',
        configData: {installationType: 'team'},
      }),
    ]);

    const {result} = renderProviders();

    await waitFor(() => expect(result.current.isPending).toBe(false));

    const msteams = result.current.providers.find(p => p.providerKey === 'msteams');
    expect(msteams?.status).toBe('connected');
  });

  it('returns isError when the integrations query fails', async () => {
    mockProviders();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      statusCode: 500,
      match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
    });

    const {result} = renderProviders();

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.providers).toHaveLength(0);
  });

  it('exposes all eligible integrations when a provider has multiple workspaces', async () => {
    mockProviders();
    mockIntegrations([
      OrganizationIntegrationsFixture({
        id: '20',
        name: 'workspace-a',
        provider: {key: 'slack'} as any,
        status: 'active',
        organizationIntegrationStatus: 'active',
      }),
      OrganizationIntegrationsFixture({
        id: '21',
        name: 'workspace-b',
        provider: {key: 'slack'} as any,
        status: 'active',
        organizationIntegrationStatus: 'active',
      }),
    ]);

    const {result} = renderProviders();

    await waitFor(() => expect(result.current.isPending).toBe(false));

    const slack = result.current.providers.find(p => p.providerKey === 'slack');
    expect(slack?.status).toBe('connected');
    // Both workspaces are eligible (Slack has no tenant restriction).
    expect(slack?.eligibleIntegrations).toHaveLength(2);
    expect(slack?.eligibleIntegrations.map(i => i.id)).toEqual(['20', '21']);
    expect(slack?.permissionLimitedIntegration).toBeUndefined();
  });

  it('is connected when msteams has both a tenant and a team installation', async () => {
    mockProviders();
    mockIntegrations([
      OrganizationIntegrationsFixture({
        id: '30',
        name: 'tenant',
        provider: {key: 'msteams'} as any,
        status: 'active',
        organizationIntegrationStatus: 'active',
        configData: {installationType: 'tenant'},
      }),
      OrganizationIntegrationsFixture({
        id: '31',
        name: 'team',
        provider: {key: 'msteams'} as any,
        status: 'active',
        organizationIntegrationStatus: 'active',
        configData: {installationType: 'team'},
      }),
    ]);

    const {result} = renderProviders();

    await waitFor(() => expect(result.current.isPending).toBe(false));

    const msteams = result.current.providers.find(p => p.providerKey === 'msteams');
    expect(msteams?.status).toBe('connected');
    // Only the team installation is eligible.
    expect(msteams?.eligibleIntegrations).toHaveLength(1);
    expect(msteams?.eligibleIntegrations[0]?.id).toBe('31');
    // Status is connected (not permission-limited), so this is unset.
    expect(msteams?.permissionLimitedIntegration).toBeUndefined();
  });

  it('returns isError when a provider config query fails', async () => {
    // discord config query fails; the other two config queries succeed.
    ['slack', 'msteams'].forEach(key => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/config/integrations/`,
        body: {providers: [GitHubIntegrationProviderFixture({key})]},
        match: [MockApiClient.matchQuery({provider_key: key})],
      });
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      statusCode: 500,
      match: [MockApiClient.matchQuery({provider_key: 'discord'})],
    });
    mockIntegrations([]);

    const {result} = renderProviders();

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.providers).toHaveLength(0);
  });

  it('retry() refetches provider config queries and clears the error', async () => {
    ['slack', 'msteams'].forEach(key => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/config/integrations/`,
        body: {providers: [GitHubIntegrationProviderFixture({key})]},
        match: [MockApiClient.matchQuery({provider_key: key})],
      });
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      statusCode: 500,
      match: [MockApiClient.matchQuery({provider_key: 'discord'})],
    });
    mockIntegrations([]);

    const {result} = renderProviders();

    await waitFor(() => expect(result.current.isError).toBe(true));

    // Fix the failing endpoint and call retry() — all query sets refetch.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {providers: [GitHubIntegrationProviderFixture({key: 'discord'})]},
      match: [MockApiClient.matchQuery({provider_key: 'discord'})],
    });

    result.current.retry();

    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(result.current.providers).toHaveLength(3);
  });

  it('keeps cached providers when a later integrations refetch fails', async () => {
    mockProviders();
    mockIntegrations([]);

    const {result} = renderProviders();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.providers).toHaveLength(3);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      statusCode: 500,
      match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
    });

    await act(async () => {
      await result.current.refetchIntegrations();
    });

    // A failed background refetch (isRefetchError) must not flip isError,
    // because isError only gates on isLoadingError. Cached rows stay visible.
    expect(result.current.isError).toBe(false);
    expect(result.current.providers).toHaveLength(3);
  });

  it('preserves provider order matching SCM_MESSAGING_PROVIDER_KEYS', async () => {
    mockProviders();
    mockIntegrations([]);

    const {result} = renderProviders();

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.providers.map(p => p.providerKey)).toEqual([
      'slack',
      'discord',
      'msteams',
    ]);
  });
});
