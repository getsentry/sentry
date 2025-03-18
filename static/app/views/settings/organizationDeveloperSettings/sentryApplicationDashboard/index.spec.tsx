import {RouterFixture} from 'sentry-fixture/routerFixture';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';
import {SentryAppWebhookRequestFixture} from 'sentry-fixture/sentryAppWebhookRequest';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import SentryApplicationDashboard from './index';

jest.mock('sentry/components/charts/baseChart', () => {
  return jest.fn().mockImplementation(() => <div data-test-id="chart" />);
});

describe('Sentry Application Dashboard', function () {
  const NUM_INSTALLS = 5;
  const NUM_UNINSTALLS = 2;

  let sentryApp: ReturnType<typeof SentryAppFixture>;
  let webhookRequest: ReturnType<typeof SentryAppWebhookRequestFixture>;

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

      webhookRequest = SentryAppWebhookRequestFixture();

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
        url: `/sentry-apps/${sentryApp.slug}/webhook-requests/`,
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

    it('shows the total install/uninstall stats', async () => {
      const router = RouterFixture({params: {appSlug: sentryApp.slug}});
      render(<SentryApplicationDashboard />, {router});
      expect(await screen.findByTestId('installs')).toHaveTextContent('Total installs5');
      expect(screen.getByTestId('uninstalls')).toHaveTextContent('Total uninstalls2');
    });

    it('shows the request log', async () => {
      const router = RouterFixture({params: {appSlug: sentryApp.slug}});
      render(<SentryApplicationDashboard />, {router});
      // The mock response has 1 request
      expect(await screen.findByTestId('request-item')).toBeInTheDocument();
      const requestLog = within(screen.getByTestId('request-item'));
      // Make sure that all the info is displayed
      expect(requestLog.getByText('https://example.com/webhook')).toBeInTheDocument();
      expect(requestLog.getByText('400')).toBeInTheDocument();
      expect(requestLog.getByText('issue.assigned')).toBeInTheDocument();
      expect(requestLog.getByText('Test Org')).toBeInTheDocument();
    });

    it('shows an empty message if there are no requests', async () => {
      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/webhook-requests/`,
        body: [],
      });

      const router = RouterFixture({params: {appSlug: sentryApp.slug}});
      render(<SentryApplicationDashboard />, {router});

      expect(
        await screen.findByText('No requests found in the last 30 days.')
      ).toBeInTheDocument();
    });

    it('shows integration and interactions chart', async () => {
      const router = RouterFixture({params: {appSlug: sentryApp.slug}});
      render(<SentryApplicationDashboard />, {router});

      expect(await screen.findAllByTestId('chart')).toHaveLength(3);
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
      webhookRequest = SentryAppWebhookRequestFixture();

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
        url: `/sentry-apps/${sentryApp.slug}/webhook-requests/`,
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

    it('shows the request log', async () => {
      const router = RouterFixture({params: {appSlug: sentryApp.slug}});
      render(<SentryApplicationDashboard />, {router});
      expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();
      // The mock response has 1 request
      expect(await screen.findByTestId('request-item')).toBeInTheDocument();
      const requestLog = within(screen.getByTestId('request-item'));
      // Make sure that all the info is displayed
      expect(requestLog.getByText('https://example.com/webhook')).toBeInTheDocument();
      expect(requestLog.getByText('400')).toBeInTheDocument();
      expect(requestLog.getByText('issue.assigned')).toBeInTheDocument();

      // Does not show the integration views
      expect(screen.queryByText('Integration Views')).not.toBeInTheDocument();
    });

    it('shows an empty message if there are no requests', async () => {
      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/webhook-requests/`,
        body: [],
      });

      const router = RouterFixture({params: {appSlug: sentryApp.slug}});
      render(<SentryApplicationDashboard />, {router});
      expect(
        await screen.findByText('No requests found in the last 30 days.')
      ).toBeInTheDocument();
    });

    it('shows the component interactions in a line chart', async () => {
      const router = RouterFixture({params: {appSlug: sentryApp.slug}});
      render(<SentryApplicationDashboard />, {router});

      expect(await screen.findByTestId('chart')).toBeInTheDocument();
    });
  });
});
