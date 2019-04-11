import React from 'react';
import {mount} from 'enzyme';
import {addQueryParamsToExistingUrl} from 'app/utils/queryString';

import OpenInContextLine from 'app/components/events/interfaces/openInContextLine';

describe('OpenInContextLine', function() {
  const filename = '/sentry/app.py';
  const group = TestStubs.Group();
  const install = TestStubs.SentryAppInstallation();
  const components = [
    {
      uuid: 'ed517da4-a324-44c0-aeea-1894cd9923fb',
      type: 'stacktrace-link',
      schema: {
        uri: '/redirection',
        url: `http://localhost:5000/redirection?installationId=${
          install.uuid
        }&projectSlug=${group.project.slug}`,
      },
      sentryApp: {
        uuid: 'b468fed3-afba-4917-80d6-bdac99c1ec05',
        slug: 'foo',
        name: 'Foo',
      },
    },
  ];

  const lineNo = 233;

  describe('with stacktrace-link component', function() {
    it('renders button', function() {
      const wrapper = mount(
        <OpenInContextLine filename={filename} lineNo={lineNo} components={components} />,
        TestStubs.routerContext()
      );
      expect(wrapper.props().components[0].schema.url).toEqual(
        `http://localhost:5000/redirection?installationId=${install.uuid}&projectSlug=${
          group.project.slug
        }`
      );
      const baseUrl = 'http://localhost:5000/redirection';
      const queryParams = {
        installationId: install.uuid,
        projectSlug: group.project.slug,
        lineNo,
        filename,
      };
      const url = addQueryParamsToExistingUrl(baseUrl, queryParams);
      expect(wrapper.find('a[data-test-id="stacktrace-link"]').prop('href')).toEqual(url);
      expect(wrapper.find('a[data-test-id="stacktrace-link"]').text()).toEqual('Foo');
    });
  });
});
