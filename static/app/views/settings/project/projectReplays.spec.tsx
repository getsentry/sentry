import {DetailedProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectReplays from 'sentry/views/settings/project/projectReplays';

describe('ProjectReplays', () => {
  const {organization} = initializeOrg();
  const project = DetailedProjectFixture({
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
    MockApiClient.addMockResponse({
      url: getProjectEndpoint,
      method: 'GET',
      body: project,
    });
  });

  it('renders the bulk delete tab when the user has write access', async () => {
    const deleteJobsMock = MockApiClient.addMockResponse({
      url: `${getProjectEndpoint}replays/jobs/delete/`,
      body: {data: []},
    });

    render(<ProjectReplays />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    await userEvent.click(await screen.findByRole('tab', {name: 'Bulk Delete'}));

    expect(await screen.findByText('No deletes found')).toBeInTheDocument();
    expect(deleteJobsMock).toHaveBeenCalled();
  });

  it('hides the bulk delete tab when the user lacks write access', async () => {
    const deleteJobsMock = MockApiClient.addMockResponse({
      url: `${getProjectEndpoint}replays/jobs/delete/`,
      body: {data: []},
    });
    const {organization: readOnlyOrganization} = initializeOrg({
      organization: {access: ['org:read', 'project:read']},
    });

    render(<ProjectReplays />, {
      organization: readOnlyOrganization,
      outletContext: {project},
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {
          ...initialRouterConfig.location,
          query: {replaySettingsTab: 'bulk-delete'},
        },
      },
    });

    expect(await screen.findByRole('tab', {name: 'Replay Issues'})).toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: 'Bulk Delete'})).not.toBeInTheDocument();
    expect(screen.queryByText('Count Deleted')).not.toBeInTheDocument();
    expect(screen.getByText('Create Rage Click Issues')).toBeInTheDocument();
    expect(deleteJobsMock).not.toHaveBeenCalled();
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

    const updatedProject = {
      ...project,
      options: {...project.options, 'sentry:replay_rage_click_issues': true},
    };
    const mock = MockApiClient.addMockResponse({
      url: getProjectEndpoint,
      method: 'PUT',
      body: updatedProject,
    });

    const checkbox = await screen.findByRole('checkbox', {
      name: 'Create Rage Click Issues',
    });
    MockApiClient.addMockResponse({
      url: getProjectEndpoint,
      method: 'GET',
      body: updatedProject,
    });
    await userEvent.click(checkbox);

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
    await waitFor(() => expect(checkbox).toBeEnabled());
    expect(checkbox).toBeChecked();
  });

  it('can toggle hydration error issue creation', async () => {
    render(<ProjectReplays />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    const updatedProject = {
      ...project,
      options: {...project.options, 'sentry:replay_hydration_error_issues': true},
    };
    const mock = MockApiClient.addMockResponse({
      url: getProjectEndpoint,
      method: 'PUT',
      body: updatedProject,
    });

    const checkbox = await screen.findByRole('checkbox', {
      name: 'Create Hydration Error Issues',
    });
    MockApiClient.addMockResponse({
      url: getProjectEndpoint,
      method: 'GET',
      body: updatedProject,
    });
    await userEvent.click(checkbox);

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
    await waitFor(() => expect(checkbox).toBeEnabled());
    expect(checkbox).toBeChecked();
  });
});
