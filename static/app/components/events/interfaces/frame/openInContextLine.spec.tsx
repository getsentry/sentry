import {GroupFixture} from 'sentry-fixture/group';
import {SentryAppInstallationFixture} from 'sentry-fixture/sentryAppInstallation';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {OpenInContextLine} from 'sentry/components/events/interfaces/frame/openInContextLine';
import type {
  SentryAppComponent,
  SentryAppSchemaStacktraceLink,
} from 'sentry/types/integrations';
import {addQueryParamsToExistingUrl} from 'sentry/utils/queryString';

describe('OpenInContextLine', function () {
  const filename = '/sentry/app.py';
  const group = GroupFixture();
  const install = SentryAppInstallationFixture();
  const components: Array<SentryAppComponent<SentryAppSchemaStacktraceLink>> = [
    {
      uuid: 'ed517da4-a324-44c0-aeea-1894cd9923fb',
      type: 'stacktrace-link',
      schema: {
        uri: '/redirection',
        url: `http://localhost:5000/redirection?installationId=${install.uuid}&projectSlug=${group.project.slug}`,
        type: 'stacktrace-link',
      },
      sentryApp: {
        uuid: 'b468fed3-afba-4917-80d6-bdac99c1ec05',
        slug: 'foo',
        name: 'Foo',
        avatars: [],
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
        avatars: [],
      },
    },
  ];

  const lineNo = 233;

  describe('with stacktrace-link component', function () {
    it('renders multiple buttons', function () {
      render(
        <OpenInContextLine filename={filename} lineNo={lineNo} components={components} />
      );

      const baseUrl = 'http://localhost:5000/redirection';
      const queryParams = {
        installationId: install.uuid,
        projectSlug: group.project.slug,
        lineNo,
        filename,
      };
      const url = addQueryParamsToExistingUrl(baseUrl, queryParams);
      expect(screen.getByRole('link', {name: 'Foo'})).toHaveAttribute('href', url);
      expect(screen.getByRole('link', {name: 'Tesla'})).toHaveAttribute(
        'href',
        'http://localhost:4000/something?filename=%2Fsentry%2Fapp.py&installationId=25d10adb-7b89-45ac-99b5-edaa714341ba&lineNo=233&projectSlug=internal'
      );
      expect(screen.getByRole('link', {name: 'Foo'})).toHaveTextContent('');
      expect(screen.getByRole('link', {name: 'Tesla'})).toHaveTextContent('');
    });
  });
});
