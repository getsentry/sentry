import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectInstallPlatform} from 'sentry/views/projectInstall/platform';

describe('ProjectInstallPlatform', function () {
  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('should redirect to if no matching platform', async function () {
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
      body: [{...project, platform: 'other'}],
    });

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/projects/org-slug/project-slug/',
      body: [{...project, platform: 'other'}],
    });

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/projects/org-slug/project-slug/rules/',
      body: [],
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

  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('should render NotFound if no matching integration/platform', async function () {
    MockApiClient.clearMockResponses();

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
});
