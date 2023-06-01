import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {ProjectInstallPlatform} from 'sentry/views/projectInstall/platform';

describe('ProjectInstallPlatform', function () {
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

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/projects/',
      body: [{...project, platform: 'lua'}],
    });

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/projects/org-slug/project-slug/rules/',
      body: [],
    });

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/projects/org-slug/project-slug/',
      body: [{...project, platform: 'lua'}],
    });

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

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/projects/',
      body: [{...project, platform: 'other'}],
    });

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/projects/org-slug/project-slug/rules/',
      body: [],
    });

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/projects/org-slug/project-slug/',
      body: [{...project, platform: 'other'}],
    });

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
});
