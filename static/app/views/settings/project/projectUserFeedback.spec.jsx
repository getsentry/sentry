import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectUserFeedback from 'sentry/views/settings/project/projectUserFeedback';

describe('ProjectUserFeedback', function () {
  const {org, project, routerContext} = initializeOrg();
  const url = `/projects/${org.slug}/${project.slug}/`;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url,
      method: 'GET',
      body: TestStubs.Project(),
    });
    MockApiClient.addMockResponse({
      url: `${url}keys/`,
      method: 'GET',
      body: [],
    });
  });

  it('can toggle sentry branding option', function () {
    render(
      <ProjectUserFeedback
        organizatigon={org}
        project={project}
        params={{orgId: org.slug, projectId: project.slug}}
      />,
      {context: routerContext}
    );

    const mock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
    });

    // Click Regenerate Token
    userEvent.click(screen.getByRole('checkbox', {name: 'Show Sentry Branding'}));

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
