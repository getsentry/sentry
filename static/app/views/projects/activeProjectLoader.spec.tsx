import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {redirectToProject} from 'sentry/actionCreators/redirectToProject';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {ActiveProjectLoader} from 'sentry/views/projects/activeProjectLoader';

jest.unmock('sentry/utils/recreateRoute');
jest.mock('sentry/actionCreators/redirectToProject', () => ({
  redirectToProject: jest.fn(),
}));

describe('ActiveProjectLoader', () => {
  const project = ProjectFixture();
  const org = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/users/`,
      method: 'GET',
      body: [],
    });
  });

  it('displays error on 404s', async () => {
    ProjectsStore.loadInitialData([]);
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      statusCode: 404,
    });

    const activeProject = (
      <ActiveProjectLoader projectSlug={project.slug}>{null}</ActiveProjectLoader>
    );

    render(activeProject, {organization: org});

    const loading = screen.getByTestId('loading-indicator');
    const errorText = await screen.findByText(
      'The project you were looking for was not found.'
    );

    expect(errorText).toBeInTheDocument();
    expect(loading).not.toBeInTheDocument();
  });

  it('fetches data again if projectId changes', async () => {
    ProjectsStore.loadInitialData([project]);
    let fetchMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      statusCode: 200,
      body: project,
    });

    const activeProject = (
      <ActiveProjectLoader projectSlug={project.slug}>{null}</ActiveProjectLoader>
    );

    const {rerender} = render(activeProject, {organization: org});

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Nothing should happen if we update and projectId is the same
    rerender(activeProject);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const newProject = ProjectFixture({slug: 'new-slug'});
    act(() => ProjectsStore.loadInitialData([project, newProject]));
    fetchMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/new-slug/`,
      method: 'GET',
      statusCode: 200,
      body: newProject,
    });

    rerender(<ActiveProjectLoader projectSlug="new-slug">{null}</ActiveProjectLoader>);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it('renders children with the detailed project', async () => {
    ProjectsStore.loadInitialData([project]);
    const fetchMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      statusCode: 200,
      body: project,
    });

    render(
      <ActiveProjectLoader projectSlug={project.slug}>
        {({project: activeProject}) => <div>{activeProject.slug}</div>}
      </ActiveProjectLoader>,
      {organization: org}
    );

    expect(await screen.findByText(project.slug)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('redirects when project was renamed (API returns different slug)', async () => {
    ProjectsStore.loadInitialData([]);
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      method: 'GET',
      body: [],
    });
    // Simulate a renamed project: request with old slug, API returns project with new slug
    // This happens because the backend follows the redirect internally
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      statusCode: 200,
      body: ProjectFixture({slug: 'renamed-project'}),
    });

    render(<ActiveProjectLoader projectSlug={project.slug}>{null}</ActiveProjectLoader>, {
      organization: org,
    });

    await waitFor(() => {
      expect(redirectToProject).toHaveBeenCalledWith('renamed-project');
    });
  });
});
