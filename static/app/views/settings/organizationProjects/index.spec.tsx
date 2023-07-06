import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import OrganizationProjectsContainer from 'sentry/views/settings/organizationProjects';

describe('OrganizationProjects', function () {
  let org;
  let project;
  let projectsGetMock;
  let statsGetMock;
  let projectsPutMock;
  const routerContext = TestStubs.routerContext();
  const router = TestStubs.router();

  beforeEach(function () {
    project = TestStubs.Project();
    org = TestStubs.Organization();

    projectsGetMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
    });

    statsGetMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/stats/',
      body: [[[], 1]],
    });

    projectsPutMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/project-slug/',
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('should render the projects in the store', async function () {
    const {container} = render(
      <OrganizationProjectsContainer
        router={router}
        routes={router.routes}
        params={router.params}
        routeParams={router.params}
        route={router.routes[0]}
        location={{...router.location, query: {}}}
      />
    );

    expect(container).toSnapshot();

    expect(screen.getByText('project-slug')).toBeInTheDocument();

    expect(projectsGetMock).toHaveBeenCalledTimes(1);
    expect(statsGetMock).toHaveBeenCalledTimes(1);
    expect(projectsPutMock).toHaveBeenCalledTimes(0);

    await userEvent.click(screen.getByRole('button', {name: 'Bookmark Project'}));
    expect(
      screen.getByRole('button', {name: 'Bookmark Project', pressed: true})
    ).toBeInTheDocument();

    expect(projectsPutMock).toHaveBeenCalledTimes(1);
  });

  it('should search organization projects', async function () {
    const searchMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });
    render(
      <OrganizationProjectsContainer
        router={router}
        routes={router.routes}
        params={router.params}
        routeParams={router.params}
        route={router.routes[0]}
        location={{...router.location, query: {}}}
      />,
      {
        context: routerContext,
      }
    );

    const searchBox = screen.getByRole('textbox');

    await userEvent.type(searchBox, project.slug);

    expect(searchMock).toHaveBeenLastCalledWith(
      `/organizations/${org.slug}/projects/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          query: project.slug,
        },
      })
    );

    await userEvent.type(searchBox, '{enter}');
    expect(routerContext.context.router.push).toHaveBeenCalledTimes(1);
  });
});
