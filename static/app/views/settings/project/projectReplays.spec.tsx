import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectReplays from 'sentry/views/settings/project/projectReplays';

describe('ProjectReplays', function () {
  const {routerProps, organization, project, routerContext} = initializeOrg();
  const url = `/projects/${organization.slug}/${project.slug}/`;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url,
      method: 'GET',
      body: ProjectFixture(),
    });
    MockApiClient.addMockResponse({
      url: `${url}keys/`,
      method: 'GET',
      body: [],
    });
  });

  it('can toggle rage click issue creation', async function () {
    render(
      <ProjectReplays {...routerProps} organization={organization} project={project} />,
      {
        context: routerContext,
      }
    );

    const mock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
    });

    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Create Rage Click Issues'})
    );

    expect(mock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'PUT',
        data: {
          options: {'sentry:replay_rage_click_issues': true},
        },
      })
    );
  });
});
