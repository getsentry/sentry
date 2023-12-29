import {Organization} from 'sentry-fixture/organization';
import {Plugin} from 'sentry-fixture/plugin';
import {Plugins} from 'sentry-fixture/plugins';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import ProjectPluginDetailsContainer, {
  ProjectPluginDetails,
} from 'sentry/views/settings/projectPlugins/details';

describe('ProjectPluginDetails', function () {
  const organization = Organization();
  const project = ProjectFixture();
  const plugins = Plugins();
  const plugin = Plugin();
  const routerProps = RouteComponentPropsFixture();

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

  it('renders', function () {
    render(
      <ProjectPluginDetailsContainer
        {...routerProps}
        organization={organization}
        project={project}
        params={{
          projectId: project.slug,
          pluginId: 'amazon-sqs',
        }}
      />
    );
  });

  it('resets plugin', async function () {
    jest.spyOn(indicators, 'addSuccessMessage');

    render(
      <ProjectPluginDetails
        {...routerProps}
        organization={organization}
        project={project}
        plugins={{plugins}}
        params={{
          projectId: project.slug,
          pluginId: 'amazon-sqs',
        }}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Reset Configuration'}));

    await waitFor(() =>
      expect(indicators.addSuccessMessage).toHaveBeenCalledWith('Plugin was reset')
    );
  });

  it('enables/disables plugin', async function () {
    jest.spyOn(indicators, 'addSuccessMessage');

    render(
      <ProjectPluginDetailsContainer
        {...routerProps}
        organization={organization}
        project={project}
        params={{
          projectId: project.slug,
          pluginId: 'amazon-sqs',
        }}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Enable Plugin'}));

    await waitFor(() =>
      expect(indicators.addSuccessMessage).toHaveBeenCalledWith('Plugin was enabled')
    );
  });
});
