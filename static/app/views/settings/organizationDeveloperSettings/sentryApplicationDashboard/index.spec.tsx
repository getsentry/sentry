import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';
import {SentryApp as SentryAppFixture} from 'sentry-fixture/sentryApp';
import {SentryAppWebhookRequest} from 'sentry-fixture/sentryAppWebhookRequest';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import SentryApplicationDashboard from './index';

jest.mock('sentry/components/charts/baseChart', () => {
  return jest.fn().mockImplementation(() => <div data-test-id="chart" />);
});

describe('Sentry Application Dashboard', function () {
  const NUM_INSTALLS = 5;
  const NUM_UNINSTALLS = 2;

  let sentryApp;
  let webhookRequest;

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('Viewing the Sentry App Dashboard for a published integration', () => {
    beforeEach(() => {
      sentryApp = SentryAppFixture({
        status: 'published',
        schema: {
          elements: [
            {type: 'stacktrace-link', uri: '/test', url: '/test'},
            {
              type: 'issue-link',
              create: {uri: '/test', required_fields: []},
              link: {uri: '/test', required_fields: []},
            },
          ],
        },
      });
      webhookRequest = SentryAppWebhookRequest();

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/stats/`,
        body: {
          totalInstalls: NUM_INSTALLS,
          totalUninstalls: NUM_UNINSTALLS,
          installStats: [[1569783600, NUM_INSTALLS]],
          uninstallStats: [[1569783600, NUM_UNINSTALLS]],
        },
      });

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/requests/`,
        body: [webhookRequest],
      });

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/interaction/`,
        body: {
          componentInteractions: {
            'stacktrace-link': [[1569783600, 1]],
            'issue-link': [[1569783600, 1]],
          },
          views: [[1569783600, 1]],
        },
      });

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });
    });

    it('shows the total install/uninstall stats', () => {
      render(
        <SentryApplicationDashboard
          {...RouteComponentPropsFixture()}
          params={{appSlug: sentryApp.slug}}
        />
      );
      expect(screen.getByTestId('installs')).toHaveTextContent('Total installs5');
      expect(screen.getByTestId('uninstalls')).toHaveTextContent('Total uninstalls2');
    });

    it('shows the request log', () => {
      render(
        <SentryApplicationDashboard
          {...RouteComponentPropsFixture()}
          params={{appSlug: sentryApp.slug}}
        />
      );
      // The mock response has 1 request
      expect(screen.getByTestId('request-item')).toBeInTheDocument();
      const requestLog = within(screen.getByTestId('request-item'));
      // Make sure that all the info is displayed
      expect(requestLog.getByText('https://example.com/webhook')).toBeInTheDocument();
      expect(requestLog.getByText('400')).toBeInTheDocument();
      expect(requestLog.getByText('issue.assigned')).toBeInTheDocument();
      expect(requestLog.getByText('Test Org')).toBeInTheDocument();
    });

    it('shows an empty message if there are no requests', () => {
      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/requests/`,
        body: [],
      });

      render(
        <SentryApplicationDashboard
          {...RouteComponentPropsFixture()}
          params={{appSlug: sentryApp.slug}}
        />
      );

      expect(
        screen.getByText('No requests found in the last 30 days.')
      ).toBeInTheDocument();
    });

    it('shows integration and interactions chart', () => {
      render(
        <SentryApplicationDashboard
          {...RouteComponentPropsFixture()}
          params={{appSlug: sentryApp.slug}}
        />
      );

      expect(screen.getAllByTestId('chart')).toHaveLength(3);
    });
  });

  describe('Viewing the Sentry App Dashboard for an internal integration', () => {
    beforeEach(() => {
      sentryApp = SentryAppFixture({
        status: 'internal',
        schema: {
          elements: [{type: 'stacktrace-link', uri: '/test', url: '/test'}],
        },
      });
      webhookRequest = SentryAppWebhookRequest();

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/stats/`,
        body: {
          totalInstalls: 1,
          totalUninstalls: 0,
          installStats: [[1569783600, 1]],
          uninstallStats: [[1569783600, 0]],
        },
      });

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/requests/`,
        body: [webhookRequest],
      });

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/interaction/`,
        body: {
          componentInteractions: {
            'stacktrace-link': [[1569783600, 1]],
          },
          views: [[1569783600, 1]],
        },
      });

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });
    });

    it('shows the request log', () => {
      render(
        <SentryApplicationDashboard
          {...RouteComponentPropsFixture()}
          params={{appSlug: sentryApp.slug}}
        />
      );
      // The mock response has 1 request
      expect(screen.getByTestId('request-item')).toBeInTheDocument();
      const requestLog = within(screen.getByTestId('request-item'));
      // Make sure that all the info is displayed
      expect(requestLog.getByText('https://example.com/webhook')).toBeInTheDocument();
      expect(requestLog.getByText('400')).toBeInTheDocument();
      expect(requestLog.getByText('issue.assigned')).toBeInTheDocument();

      // Does not show the integration views
      expect(screen.queryByText('Integration Views')).not.toBeInTheDocument();
    });

    it('shows an empty message if there are no requests', () => {
      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/requests/`,
        body: [],
      });

      render(
        <SentryApplicationDashboard
          {...RouteComponentPropsFixture()}
          params={{appSlug: sentryApp.slug}}
        />
      );
      expect(
        screen.getByText('No requests found in the last 30 days.')
      ).toBeInTheDocument();
    });

    it('shows the component interactions in a line chart', () => {
      render(
        <SentryApplicationDashboard
          {...RouteComponentPropsFixture()}
          params={{appSlug: sentryApp.slug}}
        />
      );

      expect(screen.getByTestId('chart')).toBeInTheDocument();
    });
  });
});
