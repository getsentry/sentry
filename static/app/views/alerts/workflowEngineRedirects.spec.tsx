import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  waitFor,
  type RouterConfig,
} from 'sentry-test/reactTestingLibrary';

import {
  withAutomationDetailsRedirect,
  withAutomationEditRedirect,
  withDetectorCreateRedirect,
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
    it('redirects alert rules to automation details with workflow-engine-ui flag', async () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
        features: ['workflow-engine-ui'],
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

    it('renders the wrapped component when redirects are opted out', () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
        features: ['workflow-engine-ui', 'workflow-engine-redirect-opt-out'],
      });

      const Wrapped = withAutomationEditRedirect(TestComponent);
      const initialRouterConfig: RouterConfig = {
        route: '/organizations/:orgId/alerts/rules/:ruleId/',
        location: {pathname: `/organizations/${organization.slug}/alerts/rules/1/`},
      };

      render(<Wrapped />, {organization, initialRouterConfig});

      expect(screen.getByText('Wrapped content')).toBeInTheDocument();
    });
  });

  describe('withDetectorEditRedirect', () => {
    it('redirects detector edit when detectorId is present', async () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
        features: ['workflow-engine-ui'],
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
        features: ['workflow-engine-ui'],
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
        features: ['workflow-engine-metric-issue-ui'],
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
    });

    it('does not redirect without workflow-engine-metric-issue-ui flag', async () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
        features: [],
      });

      const Wrapped = withMetricIssueRedirect(TestComponent);
      const initialRouterConfig: RouterConfig = {
        location: {
          pathname: `/organizations/${organization.slug}/alerts/`,
          query: {alert: 'alert-1', notification_uuid: 'notification-uuid'},
        },
      };

      const {router} = render(<Wrapped />, {organization, initialRouterConfig});

      // Path stays the same and we render the wrapped component
      await screen.findByText('Wrapped content');
      expect(router.location.pathname).toBe(
        `/organizations/${organization.slug}/alerts/`
      );
    });
  });

  describe('withDetectorDetailsRedirect', () => {
    it('redirects to detector details page when workflow-engine-ui is enabled', async () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
        features: ['workflow-engine-ui'],
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
        features: ['workflow-engine-ui'],
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
    });

    it('does not redirect without workflow-engine-ui flag', async () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
        features: [],
      });

      const Wrapped = withDetectorDetailsRedirect(TestComponent);
      const initialRouterConfig: RouterConfig = {
        route: '/organizations/:orgId/alerts/:ruleId/',
        location: {pathname: `/organizations/${organization.slug}/alerts/1/`},
      };

      const {router} = render(<Wrapped />, {organization, initialRouterConfig});

      // Path stays the same and we render the wrapped component
      await screen.findByText('Wrapped content');
      expect(router.location.pathname).toBe(
        `/organizations/${organization.slug}/alerts/1/`
      );
    });

    it('does not redirect when workflow-engine-redirect-opt-out flag is enabled', async () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
        features: ['workflow-engine-ui', 'workflow-engine-redirect-opt-out'],
      });

      const Wrapped = withDetectorDetailsRedirect(TestComponent);

      const initialRouterConfig: RouterConfig = {
        route: '/organizations/:orgId/alerts/:ruleId/',
        location: {pathname: `/organizations/${organization.slug}/alerts/1/`},
      };

      const {router} = render(<Wrapped />, {organization, initialRouterConfig});

      // Path stays the same and we render the wrapped component
      await screen.findByText('Wrapped content');
      expect(router.location.pathname).toBe(
        `/organizations/${organization.slug}/alerts/1/`
      );
    });

    it('does redirect from notification link even when workflow-engine-redirect-opt-out flag is enabled', async () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
        features: ['workflow-engine-ui', 'workflow-engine-redirect-opt-out'],
      });

      const Wrapped = withDetectorDetailsRedirect(TestComponent);

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

      const initialRouterConfig: RouterConfig = {
        route: '/organizations/:orgId/alerts/:ruleId/',
        location: {
          pathname: `/organizations/${organization.slug}/alerts/1/`,
          query: {alert: 'alert-1', notification_uuid: 'notification-uuid'},
        },
      };

      const {router} = render(<Wrapped />, {organization, initialRouterConfig});

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          `/organizations/${organization.slug}/issues/group-1/`
        );
      });
    });
  });

  describe('withDetectorCreateRedirect', () => {
    it('redirects detector create with a detector type', async () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
        features: ['workflow-engine-ui'],
      });

      const Wrapped = withDetectorCreateRedirect(TestComponent);
      const initialRouterConfig: RouterConfig = {
        route: '/organizations/:orgId/alerts/create/:alertType/',
        location: {pathname: `/organizations/${organization.slug}/alerts/create/crons/`},
      };

      const {router} = render(<Wrapped />, {organization, initialRouterConfig});

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          makeMonitorCreatePathname(organization.slug)
        );
      });

      expect(router.location.search).toBe('?detectorType=monitor_check_in_failure');
    });
  });

  describe('withOpenPeriodRedirect', () => {
    it('redirects open period routes to issue details', async () => {
      const organization = OrganizationFixture({
        slug: 'org-slug',
        features: ['workflow-engine-ui'],
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
        },
      };

      const {router} = render(<Wrapped />, {organization, initialRouterConfig});

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          `/organizations/${organization.slug}/issues/group-2/`
        );
      });
    });
  });
});
