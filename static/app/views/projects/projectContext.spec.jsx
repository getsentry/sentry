import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProjectContext} from 'sentry/views/projects/projectContext';

jest.unmock('sentry/utils/recreateRoute');
jest.mock('sentry/actionCreators/modal', () => ({
  redirectToProject: jest.fn(),
}));

describe('projectContext component', function () {
  const routes = [
    {path: '/', childRoutes: []},
    {name: 'Organizations', path: ':orgId/', childRoutes: []},
    {name: 'Projects', path: ':projectId/', childRoutes: []},
  ];

  const location = {query: {}};

  const project = TestStubs.Project();
  const org = TestStubs.Organization();
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
    const router = TestStubs.router();

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      statusCode: 404,
    });

    const projectContext = (
      <ProjectContext
        api={new MockApiClient()}
        params={{orgId: org.slug, projectId: project.slug}}
        projects={[]}
        routes={routes}
        router={router}
        location={location}
        orgId={org.slug}
        projectId={project.slug}
      />
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
    const router = TestStubs.router();
    let fetchMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      statusCode: 200,
      body: project,
    });

    const projectContext = (
      <ProjectContext
        api={new MockApiClient()}
        params={{orgId: org.slug, projectId: project.slug}}
        projects={[]}
        routes={routes}
        router={router}
        location={location}
        orgId={org.slug}
        projectId={project.slug}
      />
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
      body: TestStubs.Project({slug: 'new-slug'}),
    });

    rerender(
      <ProjectContext
        api={new MockApiClient()}
        params={{orgId: org.slug, projectId: project.slug}}
        projects={[]}
        routes={routes}
        router={router}
        location={location}
        orgId={org.slug}
        projectId="new-slug"
      />
    );

    expect(fetchMock).toHaveBeenCalled();
  });

  it('fetches data again if projects list changes', function () {
    const router = TestStubs.router();
    const fetchMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      statusCode: 200,
      body: project,
    });

    const projectContext = (
      <ProjectContext
        api={new MockApiClient()}
        params={{orgId: org.slug, projectId: project.slug}}
        projects={[]}
        routes={routes}
        router={router}
        location={location}
        orgId={org.slug}
        projectId={project.slug}
      />
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
      <ProjectContext
        api={new MockApiClient()}
        params={{orgId: org.slug, projectId: project.slug}}
        projects={[project]}
        routes={routes}
        router={router}
        location={location}
        orgId={org.slug}
        projectId={project.slug}
      />
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
