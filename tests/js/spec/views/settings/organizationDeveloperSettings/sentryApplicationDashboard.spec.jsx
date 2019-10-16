import React from 'react';

import {Client} from 'app/api';
import {mount} from 'sentry-test/enzyme';
import SentryApplicationDashboard from 'app/views/settings/organizationDeveloperSettings/sentryApplicationDashboard';

describe('Sentry Application Dashboard', function() {
  const NUM_INSTALLS = 5;
  const NUM_UNINSTALLS = 2;

  let org;
  let orgId;
  let sentryApp;
  let error;

  let wrapper;

  beforeEach(() => {
    Client.clearMockResponses();

    org = TestStubs.Organization();
    orgId = org.slug;
  });

  describe('Viewing the Sentry App Dashboard for a published app', () => {
    beforeEach(() => {
      sentryApp = TestStubs.SentryApp({
        status: 'published',
      });
      error = TestStubs.SentryAppWebhookError();

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/stats/`,
        body: {
          total_installs: NUM_INSTALLS,
          total_uninstalls: NUM_UNINSTALLS,
          install_stats: [[1569783600, NUM_INSTALLS]],
          uninstall_stats: [[1569783600, NUM_UNINSTALLS]],
        },
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/errors/`,
        body: [error],
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      wrapper = mount(
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

    it('shows the error log', () => {
      const errorLog = wrapper.find('PanelBody');
      const errorLogText = errorLog.find('PanelItem').text();
      // The mock response has 1 error
      expect(errorLog.find('PanelItem')).toHaveLength(1);
      // Make sure that all the info is displayed
      expect(errorLogText).toEqual(
        expect.stringContaining('https://example.com/webhook')
      );
      expect(errorLogText).toEqual(expect.stringContaining('This is an error'));
      expect(errorLogText).toEqual(expect.stringContaining('400'));
      expect(errorLogText).toEqual(expect.stringContaining('issue.assigned'));
      expect(errorLogText).toEqual(expect.stringContaining('Test Org'));
    });

    it('shows an empty message if there are no errors', () => {
      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/errors/`,
        body: [],
      });

      wrapper = mount(
        <SentryApplicationDashboard params={{appSlug: sentryApp.slug, orgId}} />,
        TestStubs.routerContext()
      );

      expect(wrapper.find('PanelBody').exists('PanelItem')).toBeFalsy();
      expect(wrapper.find('EmptyMessage').text()).toEqual(
        expect.stringContaining('No errors found.')
      );
    });
  });

  describe('Cannot view dashboard for unpublished app', () => {
    beforeEach(() => {
      sentryApp = TestStubs.SentryApp({
        status: 'unpublished',
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/stats/`,
        body: {
          total_installs: NUM_INSTALLS,
          total_uninstalls: NUM_UNINSTALLS,
          install_stats: [[1569783600, NUM_INSTALLS]],
          uninstall_stats: [[1569783600, NUM_UNINSTALLS]],
        },
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/errors/`,
        body: [error],
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      wrapper = mount(
        <SentryApplicationDashboard params={{appSlug: sentryApp.slug, orgId}} />,
        TestStubs.routerContext()
      );
    });

    it('Shows a permission error message', () => {
      expect(wrapper.exists('LoadingError')).toBeTruthy();
    });

    it('Does not show the installs chart or error log', () => {
      expect(wrapper.exists('StackedBarChart')).toBeFalsy();
      expect(wrapper.findWhere(h => h.text() === 'Error Log').exists()).toBeFalsy();
    });
  });
});
