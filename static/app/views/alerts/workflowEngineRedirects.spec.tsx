import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, waitFor, type RouterConfig} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {
  MonitorCreateRedirect,
  UptimeMonitorCreateRedirect,
  withAutomationDetailsRedirect,
  withDetectorDetailsRedirect,
  withDetectorEditRedirect,
  withMetricIssueRedirect,
  withOpenPeriodRedirect,
} from 'sentry/views/alerts/workflowEngineRedirects';
import {
  makeAutomationBasePathname,
  makeAutomationDetailsPathname,
} from 'sentry/views/automations/pathnames';
import {
  makeMonitorBasePathname,
  makeMonitorCreatePathname,
  makeMonitorDetailsPathname,
  makeMonitorEditPathname,
} from 'sentry/views/detectors/pathnames';

function TestComponent() {
  return <div>Wrapped content</div>;
}

describe('workflowEngineRedirects', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('withAutomationDetailsRedirect', () => {
    it('redirects alert rules to automation details', async () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/alert-rule-workflow/`,
        body: {alertRuleId: '1', ruleId: '1', workflowId: 'workflow-1'},
        match: [MockApiClient.matchQuery({rule_id: '1'})],
      });

      const Wrapped = withAutomationDetailsRedirect(TestComponent);
      const initialRouterConfig: RouterConfig = {
        route: '/organizations/:orgId/alerts/rules/:ruleId/',
        location: {pathname: `/organizations/${organization.slug}/alerts/rules/1/`},
      };

      const {router} = render(<Wrapped />, {organization, initialRouterConfig});

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          makeAutomationDetailsPathname(organization.slug, 'workflow-1')
        );
      });
    });

    it('redirects to the automations list without looking up the workflow when redirects are disabled', async () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
        features: ['workflow-engine-disable-legacy-alert-rule-redirects'],
      });
      const workflowRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/alert-rule-workflow/`,
        body: {alertRuleId: '1', ruleId: '1', workflowId: 'workflow-1'},
      });

      const Wrapped = withAutomationDetailsRedirect(TestComponent);
      const initialRouterConfig: RouterConfig = {
        route: '/organizations/:orgId/alerts/rules/:ruleId/',
        location: {pathname: `/organizations/${organization.slug}/alerts/rules/1/`},
      };

      const {router} = render(<Wrapped />, {organization, initialRouterConfig});

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          makeAutomationBasePathname(organization.slug)
        );
      });
      expect(workflowRequest).not.toHaveBeenCalled();
    });
  });

  describe('withDetectorEditRedirect', () => {
    it('redirects detector edit when detectorId is present', async () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
      });

      const Wrapped = withDetectorEditRedirect(TestComponent);
      const initialRouterConfig: RouterConfig = {
        route: '/organizations/:orgId/alerts/rules/:ruleId/:detectorId/',
        location: {pathname: `/organizations/${organization.slug}/alerts/rules/1/det-1/`},
      };

      const {router} = render(<Wrapped />, {organization, initialRouterConfig});

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          makeMonitorEditPathname(organization.slug, 'det-1')
        );
      });
    });

    it('fetches detector id and redirects to edit', async () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/alert-rule-detector/`,
        body: {alertRuleId: '1', detectorId: 'det-2', ruleId: '1'},
        match: [MockApiClient.matchQuery({alert_rule_id: '1'})],
      });

      const Wrapped = withDetectorEditRedirect(TestComponent);
      const initialRouterConfig: RouterConfig = {
        route: '/organizations/:orgId/alerts/rules/:ruleId/',
        location: {pathname: `/organizations/${organization.slug}/alerts/rules/1/`},
      };

      const {router} = render(<Wrapped />, {organization, initialRouterConfig});

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          makeMonitorEditPathname(organization.slug, 'det-2')
        );
      });
    });

    it('redirects to the monitors list without looking up the detector when redirects are disabled', async () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
        features: ['workflow-engine-disable-legacy-alert-rule-redirects'],
      });
      const detectorRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/alert-rule-detector/`,
        body: {alertRuleId: '1', detectorId: 'det-2', ruleId: '1'},
      });

      const Wrapped = withDetectorEditRedirect(TestComponent);
      const initialRouterConfig: RouterConfig = {
        route: '/organizations/:orgId/alerts/rules/:ruleId/',
        location: {pathname: `/organizations/${organization.slug}/alerts/rules/1/`},
      };

      const {router} = render(<Wrapped />, {organization, initialRouterConfig});

      await waitFor(() => {
        expect(router.location.pathname).toBe(makeMonitorBasePathname(organization.slug));
      });
      expect(detectorRequest).not.toHaveBeenCalled();
    });
  });

  describe('withMetricIssueRedirect', () => {
    it('redirects metric issue notification links to issue details', async () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/incident-groupopenperiod/`,
        body: {
          groupId: 'group-1',
          incidentId: null,
          incidentIdentifier: 'alert-1',
          openPeriodId: 'open-1',
        },
        match: [MockApiClient.matchQuery({incident_identifier: 'alert-1'})],
      });

      const Wrapped = withMetricIssueRedirect(TestComponent);
      const initialRouterConfig: RouterConfig = {
        location: {
          pathname: `/organizations/${organization.slug}/alerts/`,
          query: {alert: 'alert-1', notification_uuid: 'notification-uuid'},
        },
      };

      const {router} = render(<Wrapped />, {organization, initialRouterConfig});

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          `/organizations/${organization.slug}/issues/group-1/`
        );
      });
      expect(router.location.query).toMatchObject({
        alert: 'alert-1',
        notification_uuid: 'notification-uuid',
      });
    });
  });

  describe('withDetectorDetailsRedirect', () => {
    it('redirects to detector details page', async () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/alert-rule-detector/`,
        body: {alertRuleId: '1', detectorId: 'detector-3', ruleId: '1'},
        match: [MockApiClient.matchQuery({alert_rule_id: '1'})],
      });

      const Wrapped = withDetectorDetailsRedirect(TestComponent);
      const initialRouterConfig: RouterConfig = {
        route: '/organizations/:orgId/alerts/:ruleId/',
        location: {pathname: `/organizations/${organization.slug}/alerts/1/`},
      };

      const {router} = render(<Wrapped />, {organization, initialRouterConfig});

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          makeMonitorDetailsPathname(organization.slug, 'detector-3')
        );
      });
    });

    it('redirects to the monitors list when legacy redirects are disabled', async () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
        features: ['workflow-engine-disable-legacy-alert-rule-redirects'],
      });

      const Wrapped = withDetectorDetailsRedirect(TestComponent);
      const initialRouterConfig: RouterConfig = {
        route: '/organizations/:orgId/alerts/:ruleId/:detectorId/',
        location: {
          pathname: `/organizations/${organization.slug}/alerts/1/detector-3/`,
        },
      };

      const {router} = render(<Wrapped />, {organization, initialRouterConfig});

      await waitFor(() => {
        expect(router.location.pathname).toBe(makeMonitorBasePathname(organization.slug));
      });
    });

    it('redirects to issue details page when alert and notification UUID query params are present', async () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/incident-groupopenperiod/`,
        body: {
          groupId: 'group-1',
          incidentId: null,
          incidentIdentifier: 'alert-1',
          openPeriodId: 'open-1',
        },
        match: [MockApiClient.matchQuery({incident_identifier: 'alert-1'})],
      });

      const Wrapped = withDetectorDetailsRedirect(TestComponent);
      const initialRouterConfig: RouterConfig = {
        route: '/organizations/:orgId/alerts/:ruleId/',
        location: {
          pathname: `/organizations/${organization.slug}/alerts/1/`,
          query: {alert: 'alert-1', notification_uuid: 'notification-uuid'},
        },
      };

      const {router} = render(<Wrapped />, {
        organization,
        initialRouterConfig,
      });

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          `/organizations/${organization.slug}/issues/group-1/`
        );
      });
      expect(router.location.query).toMatchObject({
        alert: 'alert-1',
        notification_uuid: 'notification-uuid',
      });
    });
  });

  describe('MonitorCreateRedirect', () => {
    const organization = OrganizationFixture({slug: 'org-slug'});
    const project = ProjectFixture({id: '42', slug: 'my-project'});

    beforeEach(() => {
      ProjectsStore.loadInitialData([project]);
    });

    afterEach(() => {
      ProjectsStore.reset();
    });

    function renderRedirect(location: RouterConfig['location'], route: string) {
      return render(<MonitorCreateRedirect />, {
        organization,
        initialRouterConfig: {route, location},
      });
    }

    it('redirects detector create with a detector type', async () => {
      const {router} = renderRedirect(
        {pathname: `/organizations/${organization.slug}/alerts/new/crons/`},
        '/organizations/:orgId/alerts/new/:alertType/'
      );

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          makeMonitorCreatePathname(organization.slug)
        );
      });
      expect(router.location.search).toBe('?detectorType=monitor_check_in_failure');
    });

    it('redirects to metric monitor settings when given legacy metric alert params', async () => {
      const {router} = renderRedirect(
        {
          pathname: `/organizations/${organization.slug}/alerts/new/metric/`,
          query: {
            aggregate: 'count()',
            dataset: 'events',
            environment: 'prod',
            project: 'my-project',
            query: 'is:unresolved',
            referrer: 'discover',
          },
        },
        '/organizations/:orgId/alerts/new/:alertType/'
      );

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          `${makeMonitorCreatePathname(organization.slug)}settings`
        );
      });
      expect(router.location.query).toEqual({
        aggregate: 'count()',
        dataset: 'errors',
        detectorType: 'metric_issue',
        environment: 'prod',
        project: '42',
        query: 'is:unresolved',
        referrer: 'discover',
      });
    });

    it('keeps an explicitly empty query when given legacy metric alert params', async () => {
      const {router} = renderRedirect(
        {
          pathname: `/organizations/${organization.slug}/alerts/new/metric/`,
          query: {
            aggregate: 'count(span.duration)',
            dataset: 'events_analytics_platform',
            query: '',
          },
        },
        '/organizations/:orgId/alerts/new/:alertType/'
      );

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          `${makeMonitorCreatePathname(organization.slug)}settings`
        );
      });
      expect(router.location.query).toEqual(
        expect.objectContaining({dataset: 'spans', query: ''})
      );
    });

    it('maps legacy log alerts to the logs dataset when given log event types', async () => {
      const {router} = renderRedirect(
        {
          pathname: `/organizations/${organization.slug}/alerts/new/metric/`,
          query: {
            aggregate: 'count(message)',
            dataset: 'events_analytics_platform',
            eventTypes: 'trace_item_log',
          },
        },
        '/organizations/:orgId/alerts/new/:alertType/'
      );

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          `${makeMonitorCreatePathname(organization.slug)}settings`
        );
      });
      expect(router.location.query.dataset).toBe('logs');
    });

    it('forwards the project id when the legacy route has a project slug', async () => {
      const {router} = renderRedirect(
        {pathname: `/organizations/${organization.slug}/alerts/my-project/new/`},
        '/organizations/:orgId/alerts/:projectId/new/'
      );

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          makeMonitorCreatePathname(organization.slug)
        );
      });
      expect(router.location.query).toEqual({project: '42'});
    });

    it('forwards the project with the detector type when given a cron alert type', async () => {
      const {router} = renderRedirect(
        {
          pathname: `/organizations/${organization.slug}/alerts/new/crons/`,
          query: {project: 'my-project'},
        },
        '/organizations/:orgId/alerts/new/:alertType/'
      );

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          makeMonitorCreatePathname(organization.slug)
        );
      });
      expect(router.location.query).toEqual({
        detectorType: 'monitor_check_in_failure',
        project: '42',
      });
    });

    it('omits the project when the legacy project is not found', async () => {
      const {router} = renderRedirect(
        {
          pathname: `/organizations/${organization.slug}/alerts/wizard/`,
          query: {project: 'missing-project'},
        },
        '/organizations/:orgId/alerts/wizard/'
      );

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          makeMonitorCreatePathname(organization.slug)
        );
      });
      expect(router.location.query).toEqual({});
    });

    it('fills in the wizard template when given only a legacy alert option', async () => {
      const {router} = renderRedirect(
        {
          pathname: `/organizations/${organization.slug}/alerts/wizard/`,
          query: {alert_option: 'trans_duration', project: 'my-project'},
        },
        '/organizations/:orgId/alerts/wizard/'
      );

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          `${makeMonitorCreatePathname(organization.slug)}settings`
        );
      });
      expect(router.location.query).toEqual(
        expect.objectContaining({
          aggregate: 'p95(transaction.duration)',
          dataset: 'transactions',
          project: '42',
        })
      );
    });

    it('picks the monitor type when given a cron alert option', async () => {
      const {router} = renderRedirect(
        {
          pathname: `/organizations/${organization.slug}/alerts/wizard/`,
          query: {alert_option: 'crons_monitor'},
        },
        '/organizations/:orgId/alerts/wizard/'
      );

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          makeMonitorCreatePathname(organization.slug)
        );
      });
      expect(router.location.query).toEqual({detectorType: 'monitor_check_in_failure'});
    });

    it('ignores the alert option when the legacy alert type is an issue alert', async () => {
      const {router} = renderRedirect(
        {
          pathname: `/organizations/${organization.slug}/alerts/new/issue/`,
          query: {alert_option: 'issues', project: 'my-project'},
        },
        '/organizations/:orgId/alerts/new/:alertType/'
      );

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          makeMonitorCreatePathname(organization.slug)
        );
      });
      expect(router.location.query).toEqual({project: '42'});
    });

    it('forwards the project id when the legacy wizard route has a project slug', async () => {
      const {router} = renderRedirect(
        {pathname: `/organizations/${organization.slug}/alerts/my-project/wizard/`},
        '/organizations/:orgId/alerts/:projectId/wizard/'
      );

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          makeMonitorCreatePathname(organization.slug)
        );
      });
      expect(router.location.query).toEqual({project: '42'});
    });

    it('accepts a project id when the legacy project param is numeric', async () => {
      const {router} = renderRedirect(
        {
          pathname: `/organizations/${organization.slug}/alerts/wizard/`,
          query: {project: '42'},
        },
        '/organizations/:orgId/alerts/wizard/'
      );

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          makeMonitorCreatePathname(organization.slug)
        );
      });
      expect(router.location.query).toEqual({project: '42'});
    });

    it('redirects to the metric type picker when a metric alert has no dataset', async () => {
      const {router} = renderRedirect(
        {pathname: `/organizations/${organization.slug}/alerts/new/metric/`},
        '/organizations/:orgId/alerts/new/:alertType/'
      );

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          makeMonitorCreatePathname(organization.slug)
        );
      });
      expect(router.location.query).toEqual({detectorType: 'metric_issue'});
    });

    it('redirects to the type picker when the legacy dataset cannot be monitored', async () => {
      const {router} = renderRedirect(
        {
          pathname: `/organizations/${organization.slug}/alerts/new/metric/`,
          query: {aggregate: 'count()', dataset: 'replays'},
        },
        '/organizations/:orgId/alerts/new/:alertType/'
      );

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          makeMonitorCreatePathname(organization.slug)
        );
      });
      expect(router.location.query).toEqual({detectorType: 'metric_issue'});
    });
  });

  describe('UptimeMonitorCreateRedirect', () => {
    it('redirects uptime existing-or-create to uptime monitor create', async () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
      });

      const initialRouterConfig: RouterConfig = {
        route: '/organizations/:orgId/alerts/rules/uptime/existing-or-create/',
        location: {
          pathname: `/organizations/${organization.slug}/alerts/rules/uptime/existing-or-create/`,
        },
      };

      const {router} = render(<UptimeMonitorCreateRedirect />, {
        organization,
        initialRouterConfig,
      });

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          makeMonitorCreatePathname(organization.slug)
        );
      });

      expect(router.location.search).toBe('?detectorType=uptime_domain_failure');
    });
  });

  describe('withOpenPeriodRedirect', () => {
    it('redirects open period routes to issue details', async () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/incident-groupopenperiod/`,
        body: {
          groupId: 'group-2',
          incidentId: null,
          incidentIdentifier: 'alert-2',
          openPeriodId: 'open-2',
        },
        match: [MockApiClient.matchQuery({incident_identifier: 'alert-2'})],
      });

      const Wrapped = withOpenPeriodRedirect(TestComponent);
      const initialRouterConfig: RouterConfig = {
        route: '/organizations/:orgId/alerts/open-periods/:alertId/',
        location: {
          pathname: `/organizations/${organization.slug}/alerts/open-periods/alert-2/`,
          query: {notification_uuid: 'notification-uuid'},
        },
      };

      const {router} = render(<Wrapped />, {organization, initialRouterConfig});

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          `/organizations/${organization.slug}/issues/group-2/`
        );
      });
      expect(router.location.query).toMatchObject({
        notification_uuid: 'notification-uuid',
      });
    });
  });
});
