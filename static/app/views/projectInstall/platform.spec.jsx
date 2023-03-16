import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectInstallPlatform} from 'sentry/views/projectInstall/platform';

describe('ProjectInstallPlatform', function () {
  describe('render()', function () {
    const api = new MockApiClient();

    it('should redirect to if no matching platform', async function () {
      const {organization, router, project, routerContext} = initializeOrg({
        router: {
          location: {
            query: {},
          },
          params: {
            projectId: TestStubs.Project().slug,
            platform: 'other',
          },
        },
      });

      MockApiClient.addMockResponse({
        url: `/projects/org-slug/${project.slug}/docs/other/`,
        body: {},
      });

      MockApiClient.addMockResponse({
        method: 'GET',
        url: '/organizations/org-slug/projects/',
        body: [project],
      });

      render(
        <ProjectInstallPlatform
          api={api}
          organization={organization}
          routes={router.routes}
          router={router}
          location={router.location}
          params={router.params}
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

    it('should render NotFound if no matching integration/platform', async function () {
      const {organization, router, project, routerContext} = initializeOrg({
        router: {
          location: {
            query: {},
          },
          params: {
            projectId: TestStubs.Project().slug,
            platform: 'lua',
          },
        },
      });

      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/docs/lua/',
        statusCode: 404,
      });

      MockApiClient.addMockResponse({
        method: 'GET',
        url: '/organizations/org-slug/projects/',
        body: [project],
      });

      render(
        <ProjectInstallPlatform
          api={api}
          organization={organization}
          routes={router.routes}
          router={router}
          location={router.location}
          params={router.params}
        />,
        {
          organization,
          context: routerContext,
        }
      );

      expect(await screen.findByText('Page Not Found')).toBeInTheDocument();
    });

    it('should render documentation', async function () {
      const {organization, router, project, routerContext} = initializeOrg({
        router: {
          location: {
            query: {},
          },
          params: {
            projectId: TestStubs.Project().slug,
            platform: 'node',
          },
        },
      });

      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/docs/node/',
        body: {html: '<h1>Documentation here</h1>'},
      });

      MockApiClient.addMockResponse({
        method: 'GET',
        url: '/organizations/org-slug/projects/',
        body: [project],
      });

      render(
        <ProjectInstallPlatform
          api={api}
          organization={organization}
          routes={router.routes}
          router={router}
          location={router.location}
          params={router.params}
        />,
        {
          organization,
          context: routerContext,
        }
      );

      expect(await screen.findByText('Documentation here')).toBeInTheDocument();
    });
  });
});
