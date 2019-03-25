import React from 'react';
import {Client} from 'app/api';
import {mount} from 'enzyme';
import {addQueryParamsToExistingUrl} from 'app/utils/queryString';

import {OpenInButton} from 'app/components/events/interfaces/openInButton';

describe('OpenInButton', function() {
  const api = new Client();
  const filename = '/sentry/app.py';
  const lineNo = 123;
  const org = TestStubs.Organization({features: ['sentry-apps']});
  const group = TestStubs.Group();
  const install = TestStubs.SentryAppInstallation();

  beforeEach(() => {
    Client.clearMockResponses();
  });

  describe('with stacktrace-link component', function() {
    it('renders button', async function() {
      Client.addMockResponse({
        method: 'GET',
        url: `/organizations/${org.slug}/sentry-app-components/?filter=stacktrace-link&projectId=${group
          .project.id}`,
        body: [
          {
            uuid: 'ed517da4-a324-44c0-aeea-1894cd9923fb',
            type: 'stacktrace-link',
            schema: {
              uri: '/redirection',
              url: `http://localhost:5000/redirection?installationId=${install.uuid}&projectSlug=${group
                .project.slug}`,
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
          group={group}
          filename={filename}
          lineNo={lineNo}
        />,
        TestStubs.routerContext()
      );
      await tick();
      wrapper.update();
      expect(wrapper.state().components[0].schema.url).toEqual(
        `http://localhost:5000/redirection?installationId=${install.uuid}&projectSlug=${group
          .project.slug}`
      );
      const baseUrl = `http://localhost:5000/redirection`;
      const queryParams = {
        installationId: install.uuid,
        projectSlug: group.project.slug,
        lineNo,
        filename,
      };
      const url = addQueryParamsToExistingUrl(baseUrl, queryParams);
      expect(wrapper.find('Button').prop('href')).toEqual(url);
      expect(wrapper.find('Button').text()).toEqual('Debug In Foo');
    });
  });

  describe('without stacktrace-link component', function() {
    it('renders button', async function() {
      Client.addMockResponse({
        method: 'GET',
        url: `/organizations/${org.slug}/sentry-app-components/?filter=stacktrace-link&projectId=${group
          .project.id}`,
        body: [],
      });
      const wrapper = mount(
        <OpenInButton
          api={api}
          organization={org}
          group={group}
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

  describe('without group prop passed', function() {
    it('does not make api request', async function() {
      const response = Client.addMockResponse({
        method: 'GET',
        url: `/organizations/${org.slug}/sentry-app-components/?filter=stacktrace-link&projectId=${group
          .project.id}`,
        body: [],
      });
      const wrapper = mount(
        <OpenInButton api={api} organization={org} filename={filename} lineNo={lineNo} />,
        TestStubs.routerContext()
      );
      await tick();
      wrapper.update();
      expect(wrapper.state().components).toEqual([]);
      expect(wrapper.find('Button').exists()).toEqual(false);
      expect(response).not.toHaveBeenCalled();
    });
  });

  describe('without organization prop passed', function() {
    it('does not make api request', async function() {
      const response = Client.addMockResponse({
        method: 'GET',
        url: `/organizations/${org.slug}/sentry-app-components/?filter=stacktrace-link&projectId=${group
          .project.id}`,
        body: [],
      });
      const wrapper = mount(
        <OpenInButton api={api} filename={filename} lineNo={lineNo} />,
        TestStubs.routerContext()
      );
      await tick();
      wrapper.update();
      expect(wrapper.state().components).toEqual([]);
      expect(wrapper.find('Button').exists()).toEqual(false);
      expect(response).not.toHaveBeenCalled();
    });
  });
});
