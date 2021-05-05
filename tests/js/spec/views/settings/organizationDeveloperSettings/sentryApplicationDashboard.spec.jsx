import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import SentryApplicationDashboard from 'app/views/settings/organizationDeveloperSettings/sentryApplicationDashboard';

describe('Sentry Application Dashboard', function () {
  const NUM_INSTALLS = 5;
  const NUM_UNINSTALLS = 2;

  let org;
  let orgId;
  let sentryApp;
  let request;

  let wrapper;

  beforeEach(() => {
    Client.clearMockResponses();

    org = TestStubs.Organization();
    orgId = org.slug;
  });

  describe('Viewing the Sentry App Dashboard for a published integration', () => {
    beforeEach(() => {
      sentryApp = TestStubs.SentryApp({
        status: 'published',
        schema: {
          elements: [
            {type: 'stacktrace-link', uri: '/test'},
            {
              type: 'issue-link',
              create: {uri: '/test', required_fields: []},
              link: {uri: '/test', required_fields: []},
            },
          ],
        },
      });
      request = TestStubs.SentryAppWebhookRequest();

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/stats/`,
        body: {
          totalInstalls: NUM_INSTALLS,
          totalUninstalls: NUM_UNINSTALLS,
          installStats: [[1569783600, NUM_INSTALLS]],
          uninstallStats: [[1569783600, NUM_UNINSTALLS]],
        },
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/requests/`,
        body: [request],
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/interaction/`,
        body: {
          componentInteractions: {
            'stacktrace-link': [[1569783600, 1]],
            'issue-link': [[1569783600, 1]],
          },
          views: [[1569783600, 1]],
        },
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      wrapper = mountWithTheme(
        <SentryApplicationDashboard params={{appSlug: sentryApp.slug, orgId}} />,
        TestStubs.routerContext()
      );
    });

    it('shows the total install/uninstall stats', () => {
      const installsStat = wrapper
        .find('StatsSection')
        .filterWhere(h => h.text().includes('Total installs'))
        .find('p');

      const uninstallsStat = wrapper
        .find('StatsSection')
        .filterWhere(h => h.text().includes('Total uninstalls'))
        .find('p');

      expect(installsStat.text()).toEqual(`${NUM_INSTALLS}`);
      expect(uninstallsStat.text()).toEqual(`${NUM_UNINSTALLS}`);
    });

    it('shows the installation stats in a graph', () => {
      const chart = wrapper.find('BarChart');
      const chartSeries = chart.props().series;

      expect(chart.exists()).toBeTruthy();
      expect(chartSeries).toHaveLength(2);
      expect(chartSeries).toContainEqual({
        data: [{name: 1569783600 * 1000, value: NUM_INSTALLS}],
        seriesName: 'installed',
      });
      expect(chartSeries).toContainEqual({
        data: [{name: 1569783600 * 1000, value: NUM_UNINSTALLS}],
        seriesName: 'uninstalled',
      });
    });

    it('shows the request log', () => {
      const requestLog = wrapper.find('PanelBody');
      const requestLogText = requestLog.find('PanelItem').text();
      // The mock response has 1 request
      expect(requestLog.find('PanelItem')).toHaveLength(1);
      // Make sure that all the info is displayed
      expect(requestLogText).toEqual(
        expect.stringContaining('https://example.com/webhook')
      );
      expect(requestLogText).toEqual(expect.stringContaining('400'));
      expect(requestLogText).toEqual(expect.stringContaining('issue.assigned'));
      expect(requestLogText).toEqual(expect.stringContaining('Test Org'));
    });

    it('shows an empty message if there are no requests', () => {
      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/requests/`,
        body: [],
      });

      wrapper = mountWithTheme(
        <SentryApplicationDashboard params={{appSlug: sentryApp.slug, orgId}} />,
        TestStubs.routerContext()
      );

      expect(wrapper.find('PanelBody').exists('PanelItem')).toBeFalsy();
      expect(wrapper.find('EmptyMessage').text()).toEqual(
        expect.stringContaining('No requests found in the last 30 days.')
      );
    });

    it('shows the integration views in a line chart', () => {
      const chart = wrapper
        .find('Panel')
        .filterWhere(h => h.text().includes('Integration Views'))
        .find('LineChart');
      const chartData = chart.props().series[0].data;

      expect(chart.exists()).toBeTruthy();
      expect(chartData).toHaveLength(1);
      expect(chartData).toContainEqual({name: 1569783600 * 1000, value: 1});
    });

    it('shows the component interactions in a line chart', () => {
      const chart = wrapper
        .find('Panel')
        .filterWhere(h => h.text().includes('Component Interactions'))
        .find('LineChart');
      const chartSeries = chart.props().series;

      expect(chart.exists()).toBeTruthy();
      expect(chartSeries).toHaveLength(2);
      expect(chartSeries).toContainEqual({
        data: [{name: 1569783600 * 1000, value: 1}],
        seriesName: 'stacktrace-link',
      });
      expect(chartSeries).toContainEqual({
        data: [{name: 1569783600 * 1000, value: 1}],
        seriesName: 'issue-link',
      });
    });
  });

  describe('Viewing the Sentry App Dashboard for an internal integration', () => {
    beforeEach(() => {
      sentryApp = TestStubs.SentryApp({
        status: 'internal',
        schema: {
          elements: [{type: 'stacktrace-link', uri: '/test'}],
        },
      });
      request = TestStubs.SentryAppWebhookRequest();

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/stats/`,
        body: {
          totalInstalls: 1,
          totalUninstalls: 0,
          installStats: [[1569783600, 1]],
          uninstallStats: [[1569783600, 0]],
        },
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/requests/`,
        body: [request],
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/interaction/`,
        body: {
          componentInteractions: {
            'stacktrace-link': [[1569783600, 1]],
          },
          views: [[1569783600, 1]],
        },
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      wrapper = mountWithTheme(
        <SentryApplicationDashboard params={{appSlug: sentryApp.slug, orgId}} />,
        TestStubs.routerContext()
      );
    });

    it('does not show the installation stats or graph', () => {
      expect(wrapper.exists('StatsSection')).toBeFalsy();
      expect(wrapper.exists('BarChart')).toBeFalsy();
    });

    it('shows the request log', () => {
      const requestLog = wrapper.find('PanelBody');
      const requestLogText = requestLog.find('PanelItem').text();
      // The mock response has 1 request
      expect(requestLog.find('PanelItem')).toHaveLength(1);
      // Make sure that all the info is displayed
      expect(requestLogText).toEqual(
        expect.stringContaining('https://example.com/webhook')
      );
      expect(requestLogText).toEqual(expect.stringContaining('400'));
      expect(requestLogText).toEqual(expect.stringContaining('issue.assigned'));
    });

    it('shows an empty message if there are no requests', () => {
      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/requests/`,
        body: [],
      });

      wrapper = mountWithTheme(
        <SentryApplicationDashboard params={{appSlug: sentryApp.slug, orgId}} />,
        TestStubs.routerContext()
      );

      expect(wrapper.find('PanelBody').exists('PanelItem')).toBeFalsy();
      expect(wrapper.find('EmptyMessage').text()).toEqual(
        expect.stringContaining('No requests found in the last 30 days.')
      );
    });

    it('does not show the integration views', () => {
      const chart = wrapper.findWhere(h => h.text().includes('Integration Views'));
      expect(chart.exists()).toBeFalsy();
    });

    it('shows the component interactions in a line chart', () => {
      const chart = wrapper
        .find('Panel')
        .filterWhere(h => h.text().includes('Component Interactions'))
        .find('LineChart');
      const chartSeries = chart.props().series;

      expect(chart.exists()).toBeTruthy();
      expect(chartSeries).toHaveLength(1);
      expect(chartSeries).toContainEqual({
        data: [{name: 1569783600 * 1000, value: 1}],
        seriesName: 'stacktrace-link',
      });
    });
  });
});
