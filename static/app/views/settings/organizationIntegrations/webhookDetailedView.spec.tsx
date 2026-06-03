import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {WebhookDetailedView} from 'sentry/views/settings/organizationIntegrations/webhookDetailedView';

describe('WebhookDetailedView', () => {
  const organization = OrganizationFixture({features: ['legacy-webhook-ui']});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders overview tab with webhook description', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/legacy-webhooks/`,
      body: {projects: []},
    });

    render(<WebhookDetailedView />, {organization});

    expect(
      await screen.findByText(/Trigger outgoing HTTP POST requests/)
    ).toBeInTheDocument();
    expect(screen.getByText('Sentry Team')).toBeInTheDocument();
    expect(screen.getByText('Not Installed')).toBeInTheDocument();
  });

  it('shows installed status when projects have webhooks', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/legacy-webhooks/`,
      body: {
        projects: [
          {
            projectId: '1',
            projectSlug: 'my-project',
            projectName: 'My Project',
            projectPlatform: 'javascript',
            enabled: true,
          },
        ],
      },
    });

    render(<WebhookDetailedView />, {organization});

    expect(await screen.findByText('Installed')).toBeInTheDocument();
  });

  it('renders project configurations tab', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/legacy-webhooks/`,
      body: {
        projects: [
          {
            projectId: '1',
            projectSlug: 'my-project',
            projectName: 'My Project',
            projectPlatform: 'javascript',
            enabled: true,
          },
        ],
      },
    });

    render(<WebhookDetailedView />, {
      organization,
      initialRouterConfig: {
        location: {query: {tab: 'configurations'}},
      },
    });

    expect(await screen.findByTestId('installed-plugin')).toBeInTheDocument();
    expect(screen.getByTestId('integration-configure-button')).toBeInTheDocument();
    expect(screen.getByTestId('integration-remove-button')).toBeInTheDocument();
  });

  it('shows empty state on configurations tab with no projects', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/legacy-webhooks/`,
      body: {projects: []},
    });

    render(<WebhookDetailedView />, {
      organization,
      initialRouterConfig: {
        location: {query: {tab: 'configurations'}},
      },
    });

    expect(
      await screen.findByText('No projects have webhooks configured')
    ).toBeInTheDocument();
  });

  it('shows loading error on fetch failure', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/legacy-webhooks/`,
      statusCode: 500,
      body: {},
    });

    render(<WebhookDetailedView />, {organization});

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
  });
});
