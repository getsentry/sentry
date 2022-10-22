import {Organization} from 'fixtures/js-stubs/organization.js';
import {Plugin} from 'fixtures/js-stubs/plugin.js';
import {Plugins} from 'fixtures/js-stubs/plugins.js';
import {Project} from 'fixtures/js-stubs/project.js';
import {router} from 'fixtures/js-stubs/router.js';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import ProjectPluginDetailsContainer, {
  ProjectPluginDetails,
} from 'sentry/views/settings/projectPlugins/details';

describe('ProjectPluginDetails', function () {
  const organization = Organization();
  const project = Project();
  const router = router();
  const plugins = Plugins();
  const plugin = Plugin();

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
    const {container} = render(
      <ProjectPluginDetailsContainer
        organization={organization}
        project={project}
        params={{
          orgId: organization.slug,
          projectId: project.slug,
          pluginId: 'amazon-sqs',
        }}
        plugins={{plugins: []}}
        location={router.location}
        route={{}}
        routeParams={router.params}
        router={router}
        routes={router.routes}
      />
    );

    expect(container).toSnapshot();
  });

  it('resets plugin', async function () {
    jest.spyOn(indicators, 'addSuccessMessage');

    render(
      <ProjectPluginDetails
        organization={organization}
        project={project}
        plugins={{plugins}}
        params={{
          orgId: organization.slug,
          projectId: project.slug,
          pluginId: 'amazon-sqs',
        }}
        location={router.location}
        route={{}}
        routeParams={router.params}
        router={router}
        routes={router.routes}
      />
    );

    userEvent.click(screen.getByRole('button', {name: 'Reset Configuration'}));

    await waitFor(() =>
      expect(indicators.addSuccessMessage).toHaveBeenCalledWith('Plugin was reset')
    );
  });

  it('enables/disables plugin', async function () {
    jest.spyOn(indicators, 'addSuccessMessage');

    render(
      <ProjectPluginDetailsContainer
        organization={organization}
        project={project}
        plugins={{plugins}}
        params={{
          orgId: organization.slug,
          projectId: project.slug,
          pluginId: 'amazon-sqs',
        }}
        location={router.location}
        route={{}}
        routeParams={router.params}
        router={router}
        routes={router.routes}
      />
    );

    userEvent.click(screen.getByRole('button', {name: 'Enable Plugin'}));

    await waitFor(() =>
      expect(indicators.addSuccessMessage).toHaveBeenCalledWith('Plugin was enabled')
    );
  });
});
