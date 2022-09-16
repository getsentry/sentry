import {browserHistory} from 'react-router';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProjectInstallPlatform} from 'sentry/views/projectInstall/platform';

describe('ProjectInstallPlatform', function () {
  describe('render()', function () {
    const baseProps = {
      api: new MockApiClient(),
      organization: TestStubs.Organization(),
      project: TestStubs.Project(),
      location: {query: {}},
    };

    it('should redirect to if no matching platform', function () {
      const props = {
        ...baseProps,
        params: {
          orgId: baseProps.organization.slug,
          projectId: baseProps.project.slug,
          platform: 'other',
        },
      };

      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/docs/other/',
        body: {},
      });

      render(<ProjectInstallPlatform {...props} />, {
        context: TestStubs.routerContext([{organization: {id: '1337'}}]),
      });

      expect(browserHistory.push).toHaveBeenCalledTimes(1);
    });

    it('should render NotFound if no matching integration/platform', async function () {
      const props = {
        ...baseProps,
        params: {
          orgId: baseProps.organization.slug,
          projectId: baseProps.project.slug,
          platform: 'lua',
        },
      };

      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/docs/lua/',
        statusCode: 404,
      });

      render(<ProjectInstallPlatform {...props} />, {
        context: TestStubs.routerContext([{organization: {id: '1337'}}]),
      });

      expect(await screen.findByText('Page Not Found')).toBeInTheDocument();
    });

    it('should render documentation', async function () {
      const props = {
        ...baseProps,
        params: {
          orgId: baseProps.organization.slug,
          projectId: baseProps.project.slug,
          platform: 'node',
        },
      };

      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/docs/node/',
        body: {html: '<h1>Documentation here</h1>'},
      });

      render(<ProjectInstallPlatform {...props} />, {
        context: TestStubs.routerContext([{organization: {id: '1337'}}]),
      });

      expect(await screen.findByText('Documentation here')).toBeInTheDocument();
    });
  });
});
