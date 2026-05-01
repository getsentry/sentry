import {useContext} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {redirectToProject} from 'sentry/actionCreators/redirectToProject';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {
  ProjectRouteContext,
  ProjectRouteProvider,
} from 'sentry/views/projects/projectRouteContext';

jest.unmock('sentry/utils/recreateRoute');
jest.mock('sentry/actionCreators/redirectToProject', () => ({
  redirectToProject: jest.fn(),
}));

function ProjectSlug() {
  const project = useContext(ProjectRouteContext);
  return <div>{project?.slug}</div>;
}

describe('ProjectRouteProvider', () => {
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

    const projectRoute = (
      <ProjectRouteProvider projectSlug={project.slug}>{null}</ProjectRouteProvider>
    );

    render(projectRoute, {organization: org});

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

    const projectRoute = (
      <ProjectRouteProvider projectSlug={project.slug}>{null}</ProjectRouteProvider>
    );

    const {rerender} = render(projectRoute, {organization: org});

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Nothing should happen if we update and projectId is the same
    rerender(projectRoute);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const newProject = ProjectFixture({slug: 'new-slug'});
    act(() => ProjectsStore.loadInitialData([project, newProject]));
    fetchMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/new-slug/`,
      method: 'GET',
      statusCode: 200,
      body: newProject,
    });

    rerender(<ProjectRouteProvider projectSlug="new-slug">{null}</ProjectRouteProvider>);

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
      <ProjectRouteProvider projectSlug={project.slug}>
        <ProjectSlug />
      </ProjectRouteProvider>,
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

    render(
      <ProjectRouteProvider projectSlug={project.slug}>{null}</ProjectRouteProvider>,
      {
        organization: org,
      }
    );

    await waitFor(() => {
      expect(redirectToProject).toHaveBeenCalledWith('renamed-project');
    });
  });
});
