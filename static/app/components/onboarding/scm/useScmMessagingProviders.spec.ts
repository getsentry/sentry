import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

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
  afterEach(() => MockApiClient.clearMockResponses());

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
        provider: {key: 'slack'} as any,
        status: 'active',
        organizationIntegrationStatus: 'active',
      }),
    ]);

    const {result} = renderProviders();

    await waitFor(() => expect(result.current.isPending).toBe(false));

    const slack = result.current.providers.find(p => p.providerKey === 'slack');
    expect(slack?.status).toBe('connected');
    expect(slack?.integrations).toHaveLength(1);
    expect(slack?.integrations[0]?.id).toBe('10');

    result.current.providers
      .filter(p => p.providerKey !== 'slack')
      .forEach(p => expect(p.status).toBe('installable'));
  });

  it('ignores inactive integrations and leaves the provider installable', async () => {
    mockProviders();
    mockIntegrations([
      OrganizationIntegrationsFixture({
        id: '11',
        provider: {key: 'discord'} as any,
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
        provider: {key: 'msteams'} as any,
        status: 'active',
        organizationIntegrationStatus: 'active',
        configData: {installationType: 'tenant'},
      }),
    ]);

    const {result} = renderProviders();

    await waitFor(() => expect(result.current.isPending).toBe(false));

    const msteams = result.current.providers.find(p => p.providerKey === 'msteams');
    expect(msteams?.status).toBe('permission-limited');
    // The integration is still exposed so the row can show the workspace name.
    expect(msteams?.integrations).toHaveLength(1);
    expect(msteams?.integrations[0]?.id).toBe('12');
  });

  it('marks a team-type msteams integration as connected', async () => {
    mockProviders();
    mockIntegrations([
      OrganizationIntegrationsFixture({
        id: '13',
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

  it('exposes all active integrations when a provider has multiple workspaces', async () => {
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
    expect(slack?.integrations).toHaveLength(2);
    expect(slack?.integrations.map(i => i.id)).toEqual(['20', '21']);
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
    expect(msteams?.integrations).toHaveLength(2);
    expect(msteams?.integrations.map(i => i.id)).toEqual(['30', '31']);
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
