import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectInstallPlatform} from 'sentry/views/projectInstall/platform';

describe('ProjectInstallPlatform', function () {
  it('should render NotFound if no matching integration/platform', async function () {
    const routeParams = {
      projectId: TestStubs.Project().slug,
      platform: 'lua',
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
      body: [project],
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

  it('should redirect to if no matching platform', async function () {
    const routeParams = {
      projectId: TestStubs.Project().slug,
      platform: 'other',
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
      body: [project],
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
