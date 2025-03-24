import {OrganizationFixture} from 'sentry-fixture/organization';
import {PluginFixture} from 'sentry-fixture/plugin';
import {PluginsFixture} from 'sentry-fixture/plugins';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import ProjectPluginDetailsContainer, {
  ProjectPluginDetails,
} from 'sentry/views/settings/projectPlugins/details';

describe('ProjectPluginDetails', function () {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const plugins = PluginsFixture();
  const plugin = PluginFixture();

  beforeAll(function () {
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/`,
      method: 'GET',
      body: plugins,
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/${plugin.id}/`,
      method: 'DELETE',
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/${plugin.id}/`,
      method: 'GET',
      body: plugin,
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/${plugin.id}/`,
      method: 'POST',
      body: {
        ...plugin,
        config: [{value: 'default'}],
      },
    });
  });

  it('renders', async function () {
    const router = RouterFixture({
      params: {projectId: project.slug, pluginId: plugin.id},
    });
    render(
      <ProjectPluginDetailsContainer organization={organization} project={project} />,
      {router}
    );
    expect(await screen.findByRole('heading', {name: 'Amazon SQS'})).toBeInTheDocument();
  });

  it('resets plugin', async function () {
    jest.spyOn(indicators, 'addSuccessMessage');
    const router = RouterFixture({
      params: {projectId: project.slug, pluginId: plugin.id},
    });

    render(
      <ProjectPluginDetails
        organization={organization}
        project={project}
        plugins={{plugins}}
      />,
      {router}
    );

    await userEvent.click(
      await screen.findByRole('button', {name: 'Reset Configuration'})
    );

    await waitFor(() =>
      expect(indicators.addSuccessMessage).toHaveBeenCalledWith('Plugin was reset')
    );
  });

  it('enables/disables plugin', async function () {
    jest.spyOn(indicators, 'addSuccessMessage');
    const router = RouterFixture({
      params: {projectId: project.slug, pluginId: plugin.id},
    });

    render(
      <ProjectPluginDetailsContainer organization={organization} project={project} />,
      {router}
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Enable Plugin'}));

    await waitFor(() =>
      expect(indicators.addSuccessMessage).toHaveBeenCalledWith('Plugin was enabled')
    );
  });
});
