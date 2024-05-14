import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectUserFeedbackProcessing from 'sentry/views/settings/project/projectUserFeedbackProcessing';

describe('ProjectUserFeedbackProcessing', function () {
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

  it('can toggle spam detection', async function () {
    render(
      <ProjectUserFeedbackProcessing
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

    await userEvent.click(screen.getByRole('checkbox', {name: 'Enable Spam Detection'}));

    expect(mock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'PUT',
        data: {
          options: {'sentry:feedback_ai_spam_detection': true},
        },
      })
    );
  });
});
