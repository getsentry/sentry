import {mountWithTheme} from 'sentry-test/enzyme';

import {OpenInContextLine} from 'sentry/components/events/interfaces/frame/openInContextLine';
import {addQueryParamsToExistingUrl} from 'sentry/utils/queryString';

describe('OpenInContextLine', function () {
  const filename = '/sentry/app.py';
  const group = TestStubs.Group();
  const install = TestStubs.SentryAppInstallation();
  const components = [
    {
      uuid: 'ed517da4-a324-44c0-aeea-1894cd9923fb',
      type: 'stacktrace-link',
      schema: {
        uri: '/redirection',
        url: `http://localhost:5000/redirection?installationId=${install.uuid}&projectSlug=${group.project.slug}`,
      },
      sentryApp: {
        uuid: 'b468fed3-afba-4917-80d6-bdac99c1ec05',
        slug: 'foo',
        name: 'Foo',
      },
    },
    {
      uuid: 'dd9cc6d7-17f9-4d25-9017-4802821e694f',
      type: 'stacktrace-link',
      schema: {
        url: 'http://localhost:4000/something?installationId=25d10adb-7b89-45ac-99b5-edaa714341ba&projectSlug=internal',
        type: 'stacktrace-link',
        params: ['project', 'filename', 'lineno'],
        uri: '/something',
      },
      sentryApp: {
        uuid: '92cd01e6-0ca0-4bfc-8dcd-38fdc8960cf6',
        name: 'Tesla',
        slug: 'tesla',
      },
    },
  ];

  const lineNo = 233;

  describe('with stacktrace-link component', function () {
    it('renders multiple buttons', function () {
      const wrapper = mountWithTheme(
        <OpenInContextLine filename={filename} lineNo={lineNo} components={components} />
      );
      expect(wrapper.props().components[0].schema.url).toEqual(
        `http://localhost:5000/redirection?installationId=${install.uuid}&projectSlug=${group.project.slug}`
      );
      const baseUrl = 'http://localhost:5000/redirection';
      const queryParams = {
        installationId: install.uuid,
        projectSlug: group.project.slug,
        lineNo,
        filename,
      };
      const url = addQueryParamsToExistingUrl(baseUrl, queryParams);
      const stacktraceLinkFoo = wrapper.find(
        'OpenInLink[data-test-id="stacktrace-link-foo"]'
      );
      expect(stacktraceLinkFoo.prop('href')).toEqual(url);
      expect(stacktraceLinkFoo.text()).toEqual('Foo');
      expect(
        wrapper.find('OpenInLink[data-test-id="stacktrace-link-tesla"]').text()
      ).toEqual('Tesla');
    });
  });
});
