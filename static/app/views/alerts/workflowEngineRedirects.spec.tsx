import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, waitFor, type RouterConfig} from 'sentry-test/reactTestingLibrary';

import {
  MonitorCreateRedirect,
  UptimeMonitorCreateRedirect,
  withAutomationDetailsRedirect,
  withDetectorDetailsRedirect,
  withDetectorEditRedirect,
  withMetricIssueRedirect,
  withOpenPeriodRedirect,
} from 'sentry/views/alerts/workflowEngineRedirects';
import {makeAutomationDetailsPathname} from 'sentry/views/automations/pathnames';
import {
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
    it('redirects detector create with a detector type', async () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
      });

      const initialRouterConfig: RouterConfig = {
        route: '/organizations/:orgId/alerts/create/:alertType/',
        location: {pathname: `/organizations/${organization.slug}/alerts/create/crons/`},
      };

      const {router} = render(<MonitorCreateRedirect />, {
        organization,
        initialRouterConfig,
      });

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          makeMonitorCreatePathname(organization.slug)
        );
      });

      expect(router.location.search).toBe('?detectorType=monitor_check_in_failure');
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
