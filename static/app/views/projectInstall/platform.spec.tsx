import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {ProjectInstallPlatform} from 'sentry/views/projectInstall/platform';

function mockProjectApiResponses(projects) {
  MockApiClient.addMockResponse({
    method: 'GET',
    url: '/organizations/org-slug/projects/',
    body: projects,
  });

  MockApiClient.addMockResponse({
    method: 'GET',
    url: '/projects/org-slug/project-slug/rules/',
    body: [],
  });

  MockApiClient.addMockResponse({
    method: 'GET',
    url: '/projects/org-slug/project-slug/',
    body: projects,
  });
}

describe('ProjectInstallPlatform', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('should render NotFound if no matching integration/platform', async function () {
    const routeParams = {
      projectId: TestStubs.Project().slug,
    };
    const {organization, router, route, project, routerContext} = initializeOrg({
      router: {
        location: {
          query: {},
        },
        params: routeParams,
      },
    });

    mockProjectApiResponses([{...project, platform: 'lua'}]);

    render(
      <ProjectInstallPlatform
        router={router}
        route={route}
        location={router.location}
        routeParams={routeParams}
        routes={router.routes}
        params={routeParams}
      />,
      {
        organization,
        context: routerContext,
      }
    );

    expect(await screen.findByText('Page Not Found')).toBeInTheDocument();
  });

  it('should redirect to neutral docs if no matching platform', async function () {
    const routeParams = {
      projectId: TestStubs.Project().slug,
    };

    const {organization, router, route, project, routerContext} = initializeOrg({
      router: {
        location: {
          query: {},
        },
        params: routeParams,
      },
    });

    // this is needed because we don't handle a loading state in the UI
    ProjectsStore.loadInitialData([{...project, platform: 'other'}]);

    mockProjectApiResponses([{...project, platform: 'other'}]);

    render(
      <ProjectInstallPlatform
        router={router}
        route={route}
        location={router.location}
        routeParams={routeParams}
        routes={router.routes}
        params={routeParams}
      />,
      {
        organization,
        context: routerContext,
      }
    );

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledTimes(1);
    });
  });

  it('should render getting started docs for correct platform', async function () {
    const project = TestStubs.Project({platform: 'javascript'});

    const routeParams = {
      projectId: project.slug,
      platform: 'python',
    };

    const {router, route, routerContext} = initializeOrg({
      router: {
        location: {
          query: {},
        },
        params: routeParams,
      },
    });

    ProjectsStore.loadInitialData([project]);

    mockProjectApiResponses([project]);

    render(
      <ProjectInstallPlatform
        router={router}
        route={route}
        location={router.location}
        routeParams={routeParams}
        routes={router.routes}
        params={routeParams}
      />,
      {
        context: routerContext,
      }
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Configure JavaScript SDK',
      })
    ).toBeInTheDocument();
  });
});
