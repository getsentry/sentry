import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';

import {ProjectInstallPlatform} from 'app/views/projectInstall/platform';

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

      mountWithTheme(
        <ProjectInstallPlatform {...props} />,
        TestStubs.routerContext([{organization: {id: '1337'}}])
      );

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

      const wrapper = mountWithTheme(
        <ProjectInstallPlatform {...props} />,
        TestStubs.routerContext([{organization: {id: '1337'}}])
      );

      await tick();
      wrapper.update();

      expect(wrapper.find('NotFound')).toHaveLength(1);
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

      const wrapper = mountWithTheme(
        <ProjectInstallPlatform {...props} />,
        TestStubs.routerContext([{organization: {id: '1337'}}])
      );

      // Initially has loading indicator
      expect(wrapper.find('LoadingIndicator')).toHaveLength(1);

      await tick();
      wrapper.update();

      expect(wrapper.find('DocumentationWrapper')).toHaveLength(1);
      expect(wrapper.find('DocumentationWrapper').text()).toBe('Documentation here');
    });
  });
});
