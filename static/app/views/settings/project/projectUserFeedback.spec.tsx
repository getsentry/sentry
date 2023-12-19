import {Project as ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectUserFeedback from 'sentry/views/settings/project/projectUserFeedback';

describe('ProjectUserFeedback', function () {
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

  it('can toggle sentry branding option', async function () {
    render(
      <ProjectUserFeedback
        {...routerProps}
        organization={organization}
        project={project}
      />,
      {
        context: routerContext,
      }
    );

    const mock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
    });

    // Click Regenerate Token
    await userEvent.click(screen.getByRole('checkbox', {name: 'Show Sentry Branding'}));

    expect(mock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'PUT',
        data: {
          options: {'feedback:branding': true},
        },
      })
    );
  });
});
