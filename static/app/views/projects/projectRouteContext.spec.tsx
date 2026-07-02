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
      body: [],
    });
  });

  it('displays error on 404s', async () => {
    ProjectsStore.loadInitialData([]);
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
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
    const initialProjectRequest = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      body: project,
    });

    const projectRoute = (
      <ProjectRouteProvider projectSlug={project.slug}>{null}</ProjectRouteProvider>
    );

    const {rerender} = render(projectRoute, {organization: org});

    await waitFor(() => expect(initialProjectRequest).toHaveBeenCalledTimes(1));

    // Nothing should happen if we update and projectId is the same
    rerender(projectRoute);
    expect(initialProjectRequest).toHaveBeenCalledTimes(1);

    const newProject = ProjectFixture({slug: 'new-slug'});
    act(() => ProjectsStore.loadInitialData([project, newProject]));
    const newProjectRequest = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/new-slug/`,
      body: newProject,
    });

    rerender(<ProjectRouteProvider projectSlug="new-slug">{null}</ProjectRouteProvider>);

    await waitFor(() => expect(newProjectRequest).toHaveBeenCalled());
  });

  it('renders children with the detailed project', async () => {
    ProjectsStore.loadInitialData([project]);
    const detailedProjectRequest = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      body: project,
    });

    render(
      <ProjectRouteProvider projectSlug={project.slug}>
        <ProjectSlug />
      </ProjectRouteProvider>,
      {organization: org}
    );

    expect(await screen.findByText(project.slug)).toBeInTheDocument();
    expect(detailedProjectRequest).toHaveBeenCalledTimes(1);
  });

  it('renders children when the user has access but is not a project member', async () => {
    const nonMemberProject = ProjectFixture({hasAccess: true, isMember: false});
    ProjectsStore.loadInitialData([nonMemberProject]);
    const detailedProjectRequest = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${nonMemberProject.slug}/`,
      body: nonMemberProject,
    });

    render(
      <ProjectRouteProvider projectSlug={nonMemberProject.slug}>
        <ProjectSlug />
      </ProjectRouteProvider>,
      {organization: org}
    );

    expect(await screen.findByText(nonMemberProject.slug)).toBeInTheDocument();
    expect(detailedProjectRequest).toHaveBeenCalledTimes(1);
  });

  it('redirects when project was renamed (API returns different slug)', async () => {
    ProjectsStore.loadInitialData([]);
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });
    // Simulate a renamed project: request with old slug, API returns project with new slug
    // This happens because the backend follows the redirect internally
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
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

    expect(
      screen.queryByText('The project you were looking for was not found.')
    ).not.toBeInTheDocument();
  });

  it('shows missing membership when user lacks access and membership', async () => {
    const noAccessProject = ProjectFixture({hasAccess: false, isMember: false});
    ProjectsStore.loadInitialData([noAccessProject]);
    const detailedProjectRequest = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${noAccessProject.slug}/`,
      body: noAccessProject,
    });

    render(
      <ProjectRouteProvider projectSlug={noAccessProject.slug}>
        <ProjectSlug />
      </ProjectRouteProvider>,
      {organization: org}
    );

    expect(
      await screen.findByText(
        'No teams have access to this project yet. Ask an admin to add your team to this project.'
      )
    ).toBeInTheDocument();
    expect(detailedProjectRequest).toHaveBeenCalledTimes(1);
  });

  it('redirects when project is in store but API returns a different slug', async () => {
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      body: ProjectFixture({slug: 'renamed-project'}),
    });

    render(
      <ProjectRouteProvider projectSlug={project.slug}>
        <ProjectSlug />
      </ProjectRouteProvider>,
      {organization: org}
    );

    await waitFor(() => {
      expect(redirectToProject).toHaveBeenCalledWith('renamed-project');
    });

    expect(screen.queryByText(project.slug)).not.toBeInTheDocument();
    expect(
      screen.queryByText('The project you were looking for was not found.')
    ).not.toBeInTheDocument();
  });
});
