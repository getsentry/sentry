import React from 'react';
import {Client} from 'app/api';
import {mount} from 'enzyme';
import qs from 'query-string';

import {OpenInButton} from 'app/components/events/interfaces/openInButton';

describe('OpenInButton', function() {
  const api = new Client();
  const filename = '/sentry/app.py';
  const lineNo = 123;
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  const install = TestStubs.SentryAppInstallation();

  beforeEach(() => {
    Client.clearMockResponses();
  });

  describe('with stacktrace-link component', function() {
    it('renders button', async function() {
      Client.addMockResponse({
        method: 'GET',
        url: `/organizations/${org.slug}/sentry-app-components/?filter=stacktrace-link&projectId=${project.id}`,
        body: [
          {
            uuid: 'ed517da4-a324-44c0-aeea-1894cd9923fb',
            type: 'stacktrace-link',
            schema: {
              uri: '/redirection',
              url: `http://localhost:5000/redirection?installationId=${install.uuid}&projectSlug=${project.slug}`,
            },
            sentryApp: {
              uuid: 'b468fed3-afba-4917-80d6-bdac99c1ec05',
              slug: 'foo',
              name: 'Foo',
            },
          },
        ],
      });
      const wrapper = mount(
        <OpenInButton
          api={api}
          organization={org}
          project={project}
          filename={filename}
          lineNo={lineNo}
        />,
        TestStubs.routerContext()
      );
      await tick();
      wrapper.update();
      expect(wrapper.state().components[0].schema.url).toEqual(
        `http://localhost:5000/redirection?installationId=${install.uuid}&projectSlug=${project.slug}`
      );
      const base = `http://localhost:5000/redirection?installationId=${install.uuid}&projectSlug=${project.slug}`;
      const queryParams = {
        lineNo,
        filename,
      };
      const query = qs.stringify(queryParams);
      expect(wrapper.find('Button').prop('href')).toEqual(base + '&' + query);
      expect(wrapper.find('Button').text()).toEqual('Debug In Foo');
    });
  });

  describe('without stacktrace-link component', function() {
    it('renders button', async function() {
      Client.addMockResponse({
        method: 'GET',
        url: `/organizations/${org.slug}/sentry-app-components/?filter=stacktrace-link&projectId=${project.id}`,
        body: [],
      });
      const wrapper = mount(
        <OpenInButton
          api={api}
          organization={org}
          project={project}
          filename={filename}
          lineNo={lineNo}
        />,
        TestStubs.routerContext()
      );
      await tick();
      wrapper.update();
      expect(wrapper.state().components).toEqual([]);
      expect(wrapper.find('Button').exists()).toEqual(false);
    });
  });
});
