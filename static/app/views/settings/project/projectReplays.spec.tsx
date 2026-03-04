import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectReplays from 'sentry/views/settings/project/projectReplays';

describe('ProjectReplays', () => {
  const {organization} = initializeOrg();
  const project = ProjectFixture({
    options: {
      'sentry:replay_rage_click_issues': false,
      'sentry:replay_hydration_error_issues': false,
    },
  });
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

  it('renders both replay issue fields', async () => {
    render(<ProjectReplays />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(await screen.findByText('Create Rage Click Issues')).toBeInTheDocument();
    expect(screen.getByText('Create Hydration Error Issues')).toBeInTheDocument();
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
      body: {},
    });

    await userEvent.click(
      await screen.findByRole('checkbox', {name: 'Create Rage Click Issues'})
    );

    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        getProjectEndpoint,
        expect.objectContaining({
          method: 'PUT',
          data: {
            options: {'sentry:replay_rage_click_issues': true},
          },
        })
      )
    );
  });

  it('can toggle hydration error issue creation', async () => {
    render(<ProjectReplays />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    const mock = MockApiClient.addMockResponse({
      url: getProjectEndpoint,
      method: 'PUT',
      body: {},
    });

    await userEvent.click(
      await screen.findByRole('checkbox', {name: 'Create Hydration Error Issues'})
    );

    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        getProjectEndpoint,
        expect.objectContaining({
          method: 'PUT',
          data: {
            options: {'sentry:replay_hydration_error_issues': true},
          },
        })
      )
    );
  });
});
