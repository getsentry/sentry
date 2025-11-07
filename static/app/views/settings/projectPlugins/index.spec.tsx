import {OrganizationFixture} from 'sentry-fixture/organization';
import {PluginFixture} from 'sentry-fixture/plugin';
import {PluginsFixture} from 'sentry-fixture/plugins';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import type {Plugin} from 'sentry/types/integrations';
import type {Organization as TOrganization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import ProjectPluginsContainer from 'sentry/views/settings/projectPlugins';

describe('ProjectPluginsContainer', () => {
  let org: TOrganization, project: Project, plugins: Plugin[];

  function renderProjectPluginsContainer() {
    render(<ProjectPluginsContainer />, {
      organization: org,
      outletContext: {project},
    });
  }

  beforeEach(() => {
    org = OrganizationFixture();
    project = ProjectFixture();
    plugins = PluginsFixture([
      PluginFixture({
        enabled: true,
        id: 'disableable plugin',
        name: 'Disableable Plugin',
        slug: 'disableable plugin',
        canDisable: true,
      }),
    ]);

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/plugins/`,
      method: 'GET',
      body: plugins,
    });
  });

  it('fetches and renders plugins on mount', async () => {
    renderProjectPluginsContainer();
    expect(await screen.findByText('Amazon SQS')).toBeInTheDocument();
    expect(screen.getByText('Disableable Plugin')).toBeInTheDocument();
  });

  it('enables a plugin when clicking the toggle', async () => {
    const enableRequest = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/plugins/amazon-sqs/`,
      method: 'POST',
    });

    renderProjectPluginsContainer();
    const amazonSQS = await screen.findByText('Amazon SQS');

    const pluginItem = amazonSQS.parentElement?.parentElement?.parentElement;
    if (!pluginItem) {
      throw new Error('Plugin item not found');
    }

    expect(enableRequest).not.toHaveBeenCalled();

    const button = within(pluginItem).getByRole('checkbox');
    await userEvent.click(button);

    await waitFor(() => expect(enableRequest).toHaveBeenCalled());
  });

  it('disables a plugin when clicking the toggle', async () => {
    const disableRequest = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/plugins/disableable plugin/`,
      method: 'DELETE',
    });

    renderProjectPluginsContainer();
    const disabledPlugin = await screen.findByText('Disableable Plugin');

    const pluginItem = disabledPlugin.parentElement?.parentElement?.parentElement;
    if (!pluginItem) {
      throw new Error('Plugin item not found');
    }

    expect(disableRequest).not.toHaveBeenCalled();

    const button = within(pluginItem).getByRole('checkbox');
    await userEvent.click(button);

    await waitFor(() => expect(disableRequest).toHaveBeenCalled());
  });
});
