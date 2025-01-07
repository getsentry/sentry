import {PluginsFixture} from 'sentry-fixture/plugins';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {fetchPlugins} from 'sentry/actionCreators/plugins';
import ProjectReleaseTrackingContainer, {
  ProjectReleaseTracking,
} from 'sentry/views/settings/project/projectReleaseTracking';

jest.mock('sentry/actionCreators/plugins', () => ({
  fetchPlugins: jest.fn().mockResolvedValue([]),
}));

describe('ProjectReleaseTracking', function () {
  const {organization: org, project} = initializeOrg();
  const url = `/projects/${org.slug}/${project.slug}/releases/token/`;

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/plugins/`,
      method: 'GET',
      body: PluginsFixture(),
    });
    MockApiClient.addMockResponse({
      url,
      method: 'GET',
      body: {
        webhookUrl: 'webhook-url',
        token: 'token token token',
      },
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders with token', async function () {
    render(
      <ProjectReleaseTracking
        organization={org}
        project={project}
        plugins={{loading: false, plugins: PluginsFixture()}}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('token token token');
    });
  });

  it('can regenerate token', async function () {
    render(
      <ProjectReleaseTracking
        organization={org}
        project={project}
        plugins={{loading: false, plugins: PluginsFixture()}}
      />
    );
    renderGlobalModal();

    const mock = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {
        webhookUrl: 'webhook-url',
        token: 'token2 token2 token2',
      },
    });

    // Click Regenerate Token
    await userEvent.click(await screen.findByRole('button', {name: 'Regenerate Token'}));

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    expect(mock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('token2 token2 token2');
    });
    expect(mock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'POST',
        data: {
          project: project.slug,
        },
      })
    );
  });

  it('fetches new plugins when project changes', async function () {
    const newProject = ProjectFixture({slug: 'new-project'});
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${newProject.slug}/releases/token/`,
      method: 'GET',
      body: {
        webhookUrl: 'webhook-url',
        token: 'token token token',
      },
    });

    const {rerender} = render(
      <ProjectReleaseTrackingContainer organization={org} project={project} />
    );
    await waitFor(() => {
      expect(fetchPlugins).toHaveBeenCalled();
    });

    jest.mocked(fetchPlugins).mockClear();

    // For example, this happens when we switch to a new project using settings breadcrumb
    rerender(<ProjectReleaseTrackingContainer organization={org} project={newProject} />);

    expect(fetchPlugins).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'new-project',
      })
    );

    await waitFor(() => {
      jest.mocked(fetchPlugins).mockClear();
    });

    // Does not call fetchPlugins if slug is the same
    rerender(<ProjectReleaseTrackingContainer organization={org} project={newProject} />);
    await waitFor(() => {
      expect(fetchPlugins).not.toHaveBeenCalled();
    });
  });

  it('renders placeholders on 403', async function () {
    MockApiClient.addMockResponse({
      url,
      method: 'GET',
      status: 403,
      body: undefined,
    });

    render(
      <ProjectReleaseTracking
        organization={org}
        project={project}
        plugins={{loading: false, plugins: PluginsFixture()}}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('YOUR_TOKEN');
    });
  });
});
