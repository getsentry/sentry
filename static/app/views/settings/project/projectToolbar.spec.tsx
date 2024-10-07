import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectToolbar from 'sentry/views/settings/project/projectToolbar';

describe('ProjectToolbar', function () {
  const {routerProps, organization, project, router} = initializeOrg();
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

  it('can submit new allowed origins', async function () {
    render(
      <ProjectToolbar {...routerProps} organization={organization} project={project} />,
      {
        router,
      }
    );

    const mock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
    });

    const mockInput = 'test.io\n*.example.com';
    await userEvent.type(screen.getByLabelText('Allowed Origins'), mockInput);
    await userEvent.tab();

    expect(mock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'PUT',
        data: {
          options: {'sentry:toolbar_allowed_origins': mockInput},
        },
      })
    );
  });
});
