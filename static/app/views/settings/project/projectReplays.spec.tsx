import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectReplays from 'sentry/views/settings/project/projectReplays';

describe('ProjectReplays', () => {
  const {organization, project} = initializeOrg();
  const initialRouterConfig = {
    location: {
      pathname: `/settings/projects/${project.slug}/replays/`,
    },
    route: '/settings/projects/:projectId/replays/',
  };
  const getProjectEndpoint = `/projects/${organization.slug}/${project.slug}/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `${getProjectEndpoint}keys/`,
      method: 'GET',
      body: [],
    });
  });

  it('can toggle rage click issue creation', async () => {
    render(<ProjectReplays />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    const mock = MockApiClient.addMockResponse({
      url: getProjectEndpoint,
      method: 'PUT',
    });

    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Create Rage Click Issues'})
    );

    expect(mock).toHaveBeenCalledWith(
      getProjectEndpoint,
      expect.objectContaining({
        method: 'PUT',
        data: {
          options: {'sentry:replay_rage_click_issues': true},
        },
      })
    );
  });
});
