import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectContextProvider} from 'sentry/views/projects/projectContext';

jest.unmock('sentry/utils/recreateRoute');
jest.mock('sentry/actionCreators/modal', () => ({
  redirectToProject: jest.fn(),
}));

describe('projectContext component', function () {
  const project = ProjectFixture();
  const org = OrganizationFixture();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    [project.slug, 'new-slug'].forEach(slug => {
      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${slug}/members/`,
        method: 'GET',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${slug}/environments/`,
        method: 'GET',
        body: [],
      });
    });
  });

  it('displays error on 404s', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      statusCode: 404,
    });

    const projectContext = (
      <ProjectContextProvider
        api={new MockApiClient()}
        loadingProjects={false}
        projects={[]}
        organization={org}
        projectSlug={project.slug}
      >
        {null}
      </ProjectContextProvider>
    );

    render(projectContext);

    const loading = screen.getByTestId('loading-indicator');
    const errorText = await screen.findByText(
      'The project you were looking for was not found.'
    );

    expect(errorText).toBeInTheDocument();
    expect(loading).not.toBeInTheDocument();
  });

  it('fetches data again if projectId changes', function () {
    let fetchMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      statusCode: 200,
      body: project,
    });

    const projectContext = (
      <ProjectContextProvider
        api={new MockApiClient()}
        projects={[]}
        loadingProjects={false}
        organization={org}
        projectSlug={project.slug}
      >
        {null}
      </ProjectContextProvider>
    );

    const {rerender} = render(projectContext);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Nothing should happen if we update and projectId is the same
    rerender(projectContext);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/new-slug/`,
      method: 'GET',
      statusCode: 200,
      body: ProjectFixture({slug: 'new-slug'}),
    });

    rerender(
      <ProjectContextProvider
        api={new MockApiClient()}
        projects={[]}
        loadingProjects={false}
        organization={org}
        projectSlug="new-slug"
      >
        {null}
      </ProjectContextProvider>
    );

    expect(fetchMock).toHaveBeenCalled();
  });

  it('fetches data again if projects list changes', async function () {
    const fetchMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      statusCode: 200,
      body: project,
    });

    const projectContext = (
      <ProjectContextProvider
        api={new MockApiClient()}
        loadingProjects={false}
        projects={[]}
        organization={org}
        projectSlug={project.slug}
      >
        {null}
      </ProjectContextProvider>
    );

    const {rerender} = render(projectContext);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The project will become active, thus requesting org members
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/users/`,
      method: 'GET',
      statusCode: 200,
      body: [],
    });

    rerender(
      <ProjectContextProvider
        organization={org}
        loadingProjects={false}
        api={new MockApiClient()}
        projects={[project]}
        projectSlug={project.slug}
      >
        {null}
      </ProjectContextProvider>
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
