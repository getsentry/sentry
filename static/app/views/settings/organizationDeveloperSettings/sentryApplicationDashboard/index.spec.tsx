import {OrganizationFixture} from 'sentry-fixture/organization';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';
import {SentryAppWebhookRequestFixture} from 'sentry-fixture/sentryAppWebhookRequest';

import {render, screen, waitFor, within} from 'sentry-test/reactTestingLibrary';

import {OrganizationStore} from 'sentry/stores/organizationStore';
import type {Organization} from 'sentry/types/organization';

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
  let webhookRequestMock: ReturnType<typeof MockApiClient.addMockResponse>;

  function renderDashboard(organization: Organization = OrganizationFixture()) {
    OrganizationStore.onUpdate(organization, {replace: true});
    render(<SentryApplicationDashboard />, {
      organization,
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

      webhookRequestMock = MockApiClient.addMockResponse({
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

    it('shows the request log for org admins', async () => {
      renderDashboard(OrganizationFixture({access: ['org:admin']}));
      // The mock response has 1 request
      expect(await screen.findByTestId('request-item')).toBeInTheDocument();
      const requestLog = within(screen.getByTestId('request-item'));
      // Make sure that all the info is displayed
      expect(requestLog.getByText('https://example.com/webhook')).toBeInTheDocument();
      expect(requestLog.getByText('400')).toBeInTheDocument();
      expect(requestLog.getByText('issue.assigned')).toBeInTheDocument();
      expect(requestLog.getByText('Test Org')).toBeInTheDocument();
      expect(webhookRequestMock).toHaveBeenCalledTimes(1);
    });

    it('shows the request log for users with org integrations access', async () => {
      renderDashboard(OrganizationFixture({access: ['org:read', 'org:integrations']}));

      expect(await screen.findByTestId('request-item')).toBeInTheDocument();
      expect(webhookRequestMock).toHaveBeenCalledTimes(1);
    });

    it('does not request or render the request log for users with only org read access', async () => {
      renderDashboard(OrganizationFixture({access: ['org:read']}));

      expect(await screen.findByTestId('installs')).toHaveTextContent('Total installs5');
      expect(await screen.findByText('Integration Views')).toBeInTheDocument();
      expect(await screen.findByText('Component Interactions')).toBeInTheDocument();
      await waitFor(() => expect(screen.getAllByTestId('chart')).toHaveLength(3));
      expect(statsMock).toHaveBeenCalledTimes(1);
      expect(interactionMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('heading', {name: 'Request Log'})).toBeInTheDocument();
      expect(
        screen.getByText(
          'Only organization admins and members with integration management access can view the request log.'
        )
      ).toBeInTheDocument();
      expect(screen.queryByTestId('request-item')).not.toBeInTheDocument();
      expect(webhookRequestMock).not.toHaveBeenCalled();
    });

    it('shows the request log for active superusers without org admin access', async () => {
      renderDashboard(OrganizationFixture({access: ['org:read', 'org:superuser']}));

      expect(await screen.findByTestId('request-item')).toBeInTheDocument();
      expect(webhookRequestMock).toHaveBeenCalledTimes(1);
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

      webhookRequestMock = MockApiClient.addMockResponse({
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

    it('shows the request log for users with only org read access', async () => {
      renderDashboard(OrganizationFixture({access: ['org:read']}));
      // The mock response has 1 request
      expect(await screen.findByTestId('request-item')).toBeInTheDocument();
      const requestLog = within(screen.getByTestId('request-item'));
      // Make sure that all the info is displayed
      expect(requestLog.getByText('https://example.com/webhook')).toBeInTheDocument();
      expect(requestLog.getByText('400')).toBeInTheDocument();
      expect(requestLog.getByText('issue.assigned')).toBeInTheDocument();
      expect(webhookRequestMock).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('org-permission-alert')).not.toBeInTheDocument();

      // Does not show the integration views
      expect(screen.queryByText('Integration Views')).not.toBeInTheDocument();
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
