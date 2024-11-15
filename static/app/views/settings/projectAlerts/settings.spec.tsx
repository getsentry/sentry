import {WebhookPluginConfigFixture} from 'sentry-fixture/integrationListDirectory';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectAlertSettings from 'sentry/views/settings/projectAlerts/settings';

describe('ProjectAlertSettings', () => {
  // 12 minutes
  const digestsMinDelay = 12 * 60;
  // 55 minutes
  const digestsMaxDelay = 55 * 60;

  const project = ProjectFixture({
    digestsMinDelay,
    digestsMaxDelay,
  });
  const {organization, routerProps} = initializeOrg({
    projects: [project],
    router: {
      params: {projectId: project.slug},
    },
  });

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/`,
      method: 'GET',
      body: [],
    });
  });

  it('renders', async () => {
    render(<ProjectAlertSettings canEditRule {...routerProps} />);

    expect(
      await screen.findByPlaceholderText('e.g. $shortID - $title')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('slider', {name: 'Minimum delivery interval'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('slider', {name: 'Maximum delivery interval'})
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Oops! Looks like there aren't any available integrations installed."
      )
    ).toBeInTheDocument();
  });

  it('enables webhook integration', async () => {
    const pluginConfig = WebhookPluginConfigFixture({enabled: false});

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/`,
      method: 'GET',
      body: [pluginConfig],
    });
    const enabledPluginMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/${pluginConfig.id}/`,
      method: 'POST',
      body: '',
    });
    const getWebhookMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/${pluginConfig.id}/`,
      method: 'GET',
      body: [{...pluginConfig, enabled: true}],
    });

    render(<ProjectAlertSettings canEditRule {...routerProps} />);

    expect(
      await screen.findByPlaceholderText('e.g. $shortID - $title')
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'WebHooks'}));

    expect(await screen.findByRole('button', {name: 'Test Plugin'})).toBeInTheDocument();
    expect(enabledPluginMock).toHaveBeenCalled();
    expect(getWebhookMock).toHaveBeenCalled();
  });
});
