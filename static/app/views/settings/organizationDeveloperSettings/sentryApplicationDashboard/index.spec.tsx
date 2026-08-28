import {SentryAppFixture} from 'sentry-fixture/sentryApp';
import {SentryAppWebhookRequestFixture} from 'sentry-fixture/sentryAppWebhookRequest';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import SentryApplicationDashboard from './index';

jest.mock('sentry/components/charts/baseChart', () => ({
  BaseChart: jest.fn().mockImplementation(() => <div data-test-id="chart" />),
}));

describe('Sentry Application Dashboard', () => {
  const NUM_INSTALLS = 5;
  const NUM_UNINSTALLS = 2;

  let sentryApp: ReturnType<typeof SentryAppFixture>;
  let webhookRequest: ReturnType<typeof SentryAppWebhookRequestFixture>;
  let statsMock: ReturnType<typeof MockApiClient.addMockResponse>;
  let interactionMock: ReturnType<typeof MockApiClient.addMockResponse>;

  function renderDashboard() {
    render(<SentryApplicationDashboard />, {
      initialRouterConfig: {
        location: {
          pathname: `/settings/org-slug/developer-settings/${sentryApp.slug}/dashboard/`,
        },
        route: '/settings/:orgId/developer-settings/:appSlug/dashboard/',
      },
    });
  }

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

      statsMock = MockApiClient.addMockResponse({
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

      interactionMock = MockApiClient.addMockResponse({
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
      renderDashboard();
      expect(await screen.findByTestId('installs')).toHaveTextContent('Total installs5');
      expect(screen.getByTestId('uninstalls')).toHaveTextContent('Total uninstalls2');
    });

    it('shows the request log summary columns', async () => {
      renderDashboard();
      // The mock response has 1 request
      expect(await screen.findByTestId('request-item')).toBeInTheDocument();
      const requestLog = within(screen.getByTestId('request-item'));
      // Make sure that all the summary info is displayed
      expect(requestLog.getByText('400')).toBeInTheDocument();
      expect(requestLog.getByText('issue.assigned')).toBeInTheDocument();
      expect(requestLog.getByText('Test Org')).toBeInTheDocument();
      expect(requestLog.getByText('Issue 42')).toBeInTheDocument();
      expect(requestLog.getByText('150.00ms')).toBeInTheDocument();
      // The webhook URL moved into the expandable detail row
      expect(screen.queryByText('https://example.com/webhook')).not.toBeInTheDocument();
    });

    it('expands a row to reveal the full request detail', async () => {
      renderDashboard();
      const row = await screen.findByTestId('request-item');

      await userEvent.click(within(row).getByRole('button', {name: 'Expand row'}));

      // Detail-only fields, incl. the webhook URL and a copyable Request ID
      expect(await screen.findByText('https://example.com/webhook')).toBeInTheDocument();
      expect(screen.getByText('abc-123')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Copy Request ID'})).toBeInTheDocument();

      // Collapsing hides them again
      await userEvent.click(within(row).getByRole('button', {name: 'Collapse row'}));
      expect(screen.queryByText('https://example.com/webhook')).not.toBeInTheDocument();
    });

    it('does not link the subject for a published app', async () => {
      renderDashboard();
      const row = await screen.findByTestId('request-item');

      await userEvent.click(within(row).getByRole('button', {name: 'Expand row'}));

      expect(await screen.findByText('https://example.com/webhook')).toBeInTheDocument();
      expect(screen.queryByRole('link', {name: 'Issue 42'})).not.toBeInTheDocument();
    });

    it('renders the request body as collapsible JSON', async () => {
      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/webhook-requests/`,
        body: [SentryAppWebhookRequestFixture({request_body: '{"foo":"bar"}'})],
      });
      renderDashboard();
      const row = await screen.findByTestId('request-item');

      await userEvent.click(within(row).getByRole('button', {name: 'Expand row'}));

      expect(await screen.findByText('Request Body')).toBeInTheDocument();
      // The structured viewer surfaces the parsed keys/values, not one raw blob
      expect(screen.getByText('foo')).toBeInTheDocument();
      expect(screen.getByText('bar')).toBeInTheDocument();
    });

    it('labels no-response status codes', async () => {
      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/webhook-requests/`,
        body: [
          SentryAppWebhookRequestFixture({responseCode: 0}),
          SentryAppWebhookRequestFixture({responseCode: -1}),
        ],
      });
      renderDashboard();

      expect(await screen.findByText('timeout')).toBeInTheDocument();
      expect(screen.getByText('connection error')).toBeInTheDocument();
    });

    it('shows an empty message if there are no requests', async () => {
      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/webhook-requests/`,
        body: [],
      });

      renderDashboard();

      expect(
        await screen.findByText('No requests found in the last 30 days.')
      ).toBeInTheDocument();
    });

    it('shows an error if the request log fails to load', async () => {
      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/webhook-requests/`,
        statusCode: 500,
        body: {detail: 'Internal Error'},
      });

      renderDashboard();

      expect(await screen.findByTestId('loading-error')).toBeInTheDocument();
      expect(
        screen.queryByText('No requests found in the last 30 days.')
      ).not.toBeInTheDocument();
    });

    it('shows integration and interactions chart with a deduplicated interaction fetch', async () => {
      renderDashboard();

      await waitFor(() => expect(screen.getAllByTestId('chart')).toHaveLength(3));
      expect(statsMock).toHaveBeenCalledTimes(1);
      expect(interactionMock).toHaveBeenCalledTimes(1);
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

      statsMock = MockApiClient.addMockResponse({
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

      interactionMock = MockApiClient.addMockResponse({
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
      renderDashboard();
      // The mock response has 1 request
      expect(await screen.findByTestId('request-item')).toBeInTheDocument();
      const requestLog = within(screen.getByTestId('request-item'));
      // Make sure that the summary info is displayed
      expect(requestLog.getByText('400')).toBeInTheDocument();
      expect(requestLog.getByText('issue.assigned')).toBeInTheDocument();
      expect(requestLog.getByText('Issue 42')).toBeInTheDocument();
      expect(requestLog.getByText('150.00ms')).toBeInTheDocument();

      // Does not show the integration views
      expect(screen.queryByText('Integration Views')).not.toBeInTheDocument();
    });

    it('links the subject to its resource for an internal app', async () => {
      renderDashboard();
      const row = await screen.findByTestId('request-item');

      await userEvent.click(within(row).getByRole('button', {name: 'Expand row'}));

      const subjectLink = await screen.findByRole('link', {name: 'Issue 42'});
      expect(subjectLink).toHaveAttribute('href', '/organizations/org-slug/issues/42/');
    });

    it('shows an empty message if there are no requests', async () => {
      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/webhook-requests/`,
        body: [],
      });

      renderDashboard();
      expect(
        await screen.findByText('No requests found in the last 30 days.')
      ).toBeInTheDocument();
    });

    it('shows the component interactions in a line chart without fetching stats', async () => {
      renderDashboard();

      expect(await screen.findByTestId('chart')).toBeInTheDocument();
      expect(statsMock).not.toHaveBeenCalled();
      expect(interactionMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Viewing the Sentry App Dashboard for an unpublished integration without schema elements', () => {
    beforeEach(() => {
      sentryApp = SentryAppFixture();
      webhookRequest = SentryAppWebhookRequestFixture();

      statsMock = MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/stats/`,
        body: {
          totalInstalls: 1,
          totalUninstalls: 0,
          installStats: [[1569783600, 1]],
          uninstallStats: [[1569783600, 0]],
        },
      });

      interactionMock = MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/interaction/`,
        body: {
          componentInteractions: {},
          views: [[1569783600, 1]],
        },
      });

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/webhook-requests/`,
        body: [webhookRequest],
      });

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });
    });

    it('shows the request log without fetching stats or interactions', async () => {
      renderDashboard();

      expect(await screen.findByTestId('request-item')).toBeInTheDocument();
      expect(screen.queryByText('Integration Views')).not.toBeInTheDocument();
      expect(screen.queryByText('Component Interactions')).not.toBeInTheDocument();
      expect(statsMock).not.toHaveBeenCalled();
      expect(interactionMock).not.toHaveBeenCalled();
    });
  });
});
