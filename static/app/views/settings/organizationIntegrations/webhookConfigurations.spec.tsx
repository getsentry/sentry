import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import WebhookDetailedView from 'sentry/views/settings/organizationIntegrations/webhookDetailedView';

describe('WebhookConfigurations', () => {
  const organization = OrganizationFixture({features: ['legacy-webhook-ui']});

  const configurationsRouterConfig = {
    location: {
      pathname: `/settings/${organization.slug}/plugins/webhooks/`,
      query: {tab: 'configurations'},
    },
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders project rows with configure, uninstall, and toggle', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/legacy-webhooks/`,
      body: {
        projects: [
          {
            projectId: 1,
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
      initialRouterConfig: configurationsRouterConfig,
    });

    expect(await screen.findByTestId('webhook-project-row')).toBeInTheDocument();
    expect(screen.getByTestId('integration-configure-button')).toBeInTheDocument();
    expect(screen.getByTestId('integration-remove-button')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('shows empty state when no projects configured', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/legacy-webhooks/`,
      body: {projects: []},
    });

    render(<WebhookDetailedView />, {
      organization,
      initialRouterConfig: configurationsRouterConfig,
    });

    expect(
      await screen.findByText('No projects have webhooks configured')
    ).toBeInTheDocument();
  });

  it('renders multiple project rows', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/legacy-webhooks/`,
      body: {
        projects: [
          {
            projectId: 1,
            projectSlug: 'project-a',
            projectName: 'Project A',
            projectPlatform: 'javascript',
            enabled: true,
          },
          {
            projectId: 2,
            projectSlug: 'project-b',
            projectName: 'Project B',
            projectPlatform: 'python',
            enabled: false,
          },
        ],
      },
    });

    render(<WebhookDetailedView />, {
      organization,
      initialRouterConfig: configurationsRouterConfig,
    });

    const rows = await screen.findAllByTestId('webhook-project-row');
    expect(rows).toHaveLength(2);
  });

  it('toggles webhook enabled state', async () => {
    jest.spyOn(indicators, 'addSuccessMessage');

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/legacy-webhooks/`,
      body: {
        projects: [
          {
            projectId: 1,
            projectSlug: 'my-project',
            projectName: 'My Project',
            projectPlatform: 'javascript',
            enabled: true,
          },
        ],
      },
    });

    const toggleMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/my-project/legacy-webhooks/`,
      method: 'POST',
      body: {urls: [], enabled: false},
    });

    render(<WebhookDetailedView />, {
      organization,
      initialRouterConfig: configurationsRouterConfig,
    });

    await userEvent.click(await screen.findByRole('checkbox'));

    await waitFor(() => expect(toggleMock).toHaveBeenCalled());
    expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
      'Configuration was disabled.'
    );
  });

  it('configure button links to project webhook page', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/legacy-webhooks/`,
      body: {
        projects: [
          {
            projectId: 1,
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
      initialRouterConfig: configurationsRouterConfig,
    });

    const configureButton = await screen.findByTestId('integration-configure-button');
    expect(configureButton).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/projects/my-project/plugins/webhooks/`
    );
  });
});
