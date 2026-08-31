import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {IntegrationProviderFixture} from 'sentry-fixture/integrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import type {Integration, IntegrationProvider} from 'sentry/types/integrations';

import SeerConnectors from 'getsentry/views/seerAutomation/connectors';

describe('SeerConnectors', () => {
  const organization = OrganizationFixture({
    features: ['seer-infra-telemetry'],
  });

  function makeProvider(params: Partial<IntegrationProvider>): IntegrationProvider {
    return IntegrationProviderFixture({
      features: ['seer-context'],
      ...params,
    });
  }

  function makeIntegration(providerKey: string, status: Integration['status']) {
    return GitHubIntegrationFixture({
      provider: {
        key: providerKey,
        slug: providerKey,
        name: providerKey,
        canAdd: true,
        canDisable: false,
        features: [],
        aspects: {},
      },
      status,
      organizationIntegrationStatus: status,
    });
  }

  function mockConfig(providers: IntegrationProvider[]) {
    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {providers},
    });
  }

  function mockIntegrations(integrations: Integration[]) {
    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: integrations,
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('redirects when the org lacks the seer-infra-telemetry feature', async () => {
    const orgWithoutFeature = OrganizationFixture({features: []});

    const {router} = render(<SeerConnectors />, {
      organization: orgWithoutFeature,
      initialRouterConfig: {
        location: {pathname: `/settings/${orgWithoutFeature.slug}/seer/connectors/`},
        route: '/settings/:orgId/seer/',
        children: [
          {path: 'connectors/', element: <div>Connectors page</div>},
          {index: true, element: <div>Seer settings</div>},
        ],
      },
    });

    await waitFor(() =>
      expect(router.location.pathname).toBe(`/settings/${orgWithoutFeature.slug}/seer/`)
    );
    expect(screen.queryByText('Connectors page')).not.toBeInTheDocument();
  });

  it('renders header and only seer-context providers', async () => {
    mockConfig([
      makeProvider({key: 'gcp', slug: 'gcp', name: 'Google Cloud Platform'}),
      makeProvider({key: 'datadog', slug: 'datadog', name: 'Datadog'}),
      // Not a seer-context provider: must be filtered out.
      makeProvider({
        key: 'github',
        slug: 'github',
        name: 'GitHub',
        features: [],
      }),
    ]);
    mockIntegrations([]);

    render(<SeerConnectors />, {organization});

    expect(await screen.findByText('Google Cloud Platform')).toBeInTheDocument();
    expect(screen.getByText('Datadog')).toBeInTheDocument();
    expect(screen.queryByText('GitHub')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'Connect external monitoring tools to let Seer access infrastructure telemetry when investigating issues.'
      )
    ).toBeInTheDocument();
  });

  it('shows install status per provider', async () => {
    mockConfig([
      makeProvider({key: 'gcp', slug: 'gcp', name: 'Google Cloud Platform'}),
      makeProvider({key: 'datadog', slug: 'datadog', name: 'Datadog'}),
    ]);
    mockIntegrations([makeIntegration('gcp', 'active')]);

    render(<SeerConnectors />, {organization});

    expect(await screen.findByText('Installed')).toBeInTheDocument();
    expect(screen.getByText('Not Installed')).toBeInTheDocument();
  });

  it('links a provider name to its integration detail page', async () => {
    mockConfig([makeProvider({key: 'gcp', slug: 'gcp', name: 'Google Cloud Platform'})]);
    mockIntegrations([]);

    render(<SeerConnectors />, {organization});

    const link = await screen.findByRole('link', {name: 'Google Cloud Platform'});
    expect(link).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/integrations/gcp/`
    );
  });

  it('shows the empty state when no seer-context providers are available', async () => {
    mockConfig([
      makeProvider({key: 'github', slug: 'github', name: 'GitHub', features: []}),
    ]);
    mockIntegrations([]);

    render(<SeerConnectors />, {organization});

    expect(
      await screen.findByText(
        'No monitoring connectors are available for this organization.'
      )
    ).toBeInTheDocument();
  });

  it('shows an error state when a fetch fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      statusCode: 500,
    });
    mockIntegrations([]);

    render(<SeerConnectors />, {organization});

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
  });
});
