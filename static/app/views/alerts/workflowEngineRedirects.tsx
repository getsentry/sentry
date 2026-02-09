import LoadingIndicator from 'sentry/components/loadingIndicator';
import Redirect from 'sentry/components/redirect';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  makeAutomationDetailsPathname,
  makeAutomationEditPathname,
} from 'sentry/views/automations/pathnames';
import {
  makeMonitorCreatePathname,
  makeMonitorDetailsPathname,
  makeMonitorEditPathname,
} from 'sentry/views/detectors/pathnames';

interface AlertRuleWorkflow {
  alertRuleId: string | null;
  ruleId: string | null;
  workflowId: string;
}

interface AlertRuleDetector {
  alertRuleId: string | null;
  detectorId: string;
  ruleId: string | null;
}

interface IncidentGroupOpenPeriod {
  groupId: string;
  incidentId: string | null;
  incidentIdentifier: string;
  openPeriodId: string;
}

/**
 * HoC that wraps a component to handle workflow engine
 * redirects for issue alert rules. Fetches workflow data if needed and
 * shows loading state while requests are in flight.
 */
function withRuleRedirect<P extends Record<string, any>>(
  Component: React.ComponentType<P>,
  makeRedirectPath: (workflowId: string, orgSlug: string) => string
) {
  return function WorkflowEngineRedirectWrapper(props: P) {
    const organization = useOrganization();
    const {ruleId} = useParams();

    const hasRedirectOptOut = organization.features.includes(
      'workflow-engine-redirect-opt-out'
    );
    const shouldRedirect =
      !hasRedirectOptOut && organization.features.includes('workflow-engine-ui');

    const {data: alertRuleWorkflow, isPending} = useApiQuery<AlertRuleWorkflow>(
      [
        getApiUrl('/organizations/$organizationIdOrSlug/alert-rule-workflow/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        {query: {rule_id: ruleId}},
      ],
      {
        staleTime: 0,
        enabled: shouldRedirect && !!ruleId,
        retry: false,
      }
    );

    if (shouldRedirect) {
      if (isPending) {
        return <LoadingIndicator />;
      }
      if (alertRuleWorkflow) {
        return (
          <Redirect
            to={makeRedirectPath(alertRuleWorkflow.workflowId, organization.slug)}
          />
        );
      }
    }

    return <Component {...(props as any)} />;
  };
}

/**
 * HoC that wraps a component to handle workflow engine
 * redirects for metric alert rules. Fetches detector data if needed and
 * shows loading state while requests are in flight.
 */
function withAlertRuleRedirect<P extends Record<string, any>>(
  Component: React.ComponentType<P>,
  makeRedirectPath: (detectorId: string, orgSlug: string) => string
) {
  return function WorkflowEngineRedirectWrapper(props: P) {
    const organization = useOrganization();
    const {ruleId, detectorId} = useParams();

    const hasRedirectOptOut = organization.features.includes(
      'workflow-engine-redirect-opt-out'
    );
    const shouldRedirect =
      !hasRedirectOptOut && organization.features.includes('workflow-engine-ui');

    const {data: alertRuleDetector, isPending} = useApiQuery<AlertRuleDetector>(
      [
        getApiUrl('/organizations/$organizationIdOrSlug/alert-rule-detector/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        {query: {alert_rule_id: ruleId}},
      ],
      {
        staleTime: 0,
        enabled: shouldRedirect && !!ruleId && !detectorId,
        retry: false,
      }
    );

    if (shouldRedirect) {
      if (detectorId) {
        return <Redirect to={makeRedirectPath(detectorId, organization.slug)} />;
      }
      if (isPending) {
        return <LoadingIndicator />;
      }
      if (alertRuleDetector) {
        return (
          <Redirect
            to={makeRedirectPath(alertRuleDetector.detectorId, organization.slug)}
          />
        );
      }
    }

    return <Component {...(props as any)} />;
  };
}

export const withAutomationDetailsRedirect = <P extends Record<string, any>>(
  Component: React.ComponentType<P>
) =>
  withRuleRedirect(Component, (workflowId, orgSlug) =>
    makeAutomationDetailsPathname(orgSlug, workflowId)
  );

export const withAutomationEditRedirect = <P extends Record<string, any>>(
  Component: React.ComponentType<P>
) =>
  withRuleRedirect(Component, (workflowId, orgSlug) =>
    makeAutomationEditPathname(orgSlug, workflowId)
  );

export const withMetricIssueRedirect = <P extends Record<string, any>>(
  Component: React.ComponentType<P>
) => {
  return function MetricIssueRedirectWrapper(props: P) {
    const organization = useOrganization();
    const location = useLocation();
    const alertId = location.query.alert as string | undefined;
    const notificationUuid = location.query.notification_uuid;

    const hasWorkflowEngineMetricIssueUI = organization.features.includes(
      'workflow-engine-metric-issue-ui'
    );
    const hasMetricIssues = hasWorkflowEngineMetricIssueUI;
    const shouldRedirectToIssue = notificationUuid && alertId && hasMetricIssues;

    // If the org has metric issues, we want notification links to redirect to the metric issue details page
    if (shouldRedirectToIssue) {
      return (
        <RedirectToIssue alertId={alertId}>
          <Component {...(props as any)} />
        </RedirectToIssue>
      );
    }

    return <Component {...(props as any)} />;
  };
};

export const withDetectorDetailsRedirect = <P extends Record<string, any>>(
  Component: React.ComponentType<P>
) => {
  return function WorkflowEngineRedirectWrapper(props: P) {
    const organization = useOrganization();
    const {ruleId, detectorId} = useParams();
    const location = useLocation();
    const alertId = location.query.alert as string | undefined;
    const notificationUuid = location.query.notification_uuid;

    const hasWorkflowEngineUI = organization.features.includes('workflow-engine-ui');
    const hasRedirectOptOut = organization.features.includes(
      'workflow-engine-redirect-opt-out'
    );
    // When clicking from a notification, we never want to opt out of the redirect
    const optOutOfRedirects = hasRedirectOptOut && !notificationUuid;
    const shouldRedirect = hasWorkflowEngineUI && !optOutOfRedirects;

    if (shouldRedirect) {
      if (alertId) {
        return (
          <RedirectToIssue alertId={alertId}>
            <Component {...(props as any)} />
          </RedirectToIssue>
        );
      }

      if (detectorId) {
        return (
          <Redirect to={makeMonitorDetailsPathname(organization.slug, detectorId)} />
        );
      }

      if (ruleId) {
        return (
          <RedirectToDetector ruleId={ruleId}>
            <Component {...(props as any)} />
          </RedirectToDetector>
        );
      }
    }

    return <Component {...(props as any)} />;
  };
};

function RedirectToIssue({
  alertId,
  children,
}: {
  alertId: string;
  children: React.ReactNode;
}) {
  const organization = useOrganization();

  const {data: incidentGroupOpenPeriod, isPending: isOpenPeriodPending} =
    useApiQuery<IncidentGroupOpenPeriod>(
      [
        getApiUrl('/organizations/$organizationIdOrSlug/incident-groupopenperiod/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        {query: {incident_identifier: alertId}},
      ],
      {
        staleTime: 0,
        enabled: !!alertId,
        retry: false,
      }
    );

  if (isOpenPeriodPending) {
    return <LoadingIndicator />;
  }

  if (incidentGroupOpenPeriod) {
    return (
      <Redirect
        to={`/organizations/${organization.slug}/issues/${incidentGroupOpenPeriod.groupId}/`}
      />
    );
  }

  return children;
}

function RedirectToDetector({
  ruleId,
  children,
}: {
  children: React.ReactNode;
  ruleId: string;
}) {
  const organization = useOrganization();
  const {data: alertRuleDetector, isPending: isDetectorPending} =
    useApiQuery<AlertRuleDetector>(
      [
        getApiUrl('/organizations/$organizationIdOrSlug/alert-rule-detector/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        {query: {alert_rule_id: ruleId}},
      ],
      {
        staleTime: 0,
        retry: false,
      }
    );

  if (isDetectorPending) {
    return <LoadingIndicator />;
  }
  if (alertRuleDetector) {
    return (
      <Redirect
        to={makeMonitorDetailsPathname(organization.slug, alertRuleDetector.detectorId)}
      />
    );
  }
  return children;
}

export const withDetectorEditRedirect = <P extends Record<string, any>>(
  Component: React.ComponentType<P>
) =>
  withAlertRuleRedirect(Component, (detectorId, orgSlug) =>
    makeMonitorEditPathname(orgSlug, detectorId)
  );

const getDetectionType = (type: string | undefined): string | null => {
  switch (type) {
    case 'crons':
      return 'monitor_check_in_failure';
    case 'uptime':
      return 'uptime_domain_failure';
    default:
      return null;
  }
};

export function withDetectorCreateRedirect<P extends Record<string, any>>(
  Component: React.ComponentType<P>
) {
  return function WorkflowEngineRedirectWrapper(props: P) {
    const organization = useOrganization();
    const {alertType} = useParams();

    const hasRedirectOptOut = organization.features.includes(
      'workflow-engine-redirect-opt-out'
    );
    const shouldRedirect =
      !hasRedirectOptOut && organization.features.includes('workflow-engine-ui');

    if (shouldRedirect) {
      const detectorType = getDetectionType(alertType);
      const redirectPath = detectorType
        ? makeMonitorCreatePathname(organization.slug) + `?detectorType=${detectorType}`
        : makeMonitorCreatePathname(organization.slug);

      return <Redirect to={redirectPath} />;
    }

    return <Component {...(props as any)} />;
  };
}

export function withOpenPeriodRedirect<P extends Record<string, any>>(
  Component: React.ComponentType<P>
) {
  return function OpenPeriodRedirectWrapper(props: P) {
    const organization = useOrganization();
    const {alertId} = useParams();

    const hasRedirectOptOut = organization.features.includes(
      'workflow-engine-redirect-opt-out'
    );
    const shouldRedirect =
      !hasRedirectOptOut && organization.features.includes('workflow-engine-ui');

    const {data: incidentGroupOpenPeriod, isPending} =
      useApiQuery<IncidentGroupOpenPeriod>(
        [
          getApiUrl('/organizations/$organizationIdOrSlug/incident-groupopenperiod/', {
            path: {organizationIdOrSlug: organization.slug},
          }),
          {query: {incident_identifier: alertId}},
        ],
        {
          staleTime: 0,
          enabled: shouldRedirect && !!alertId,
          retry: false,
        }
      );

    if (shouldRedirect) {
      if (isPending) {
        return <LoadingIndicator />;
      }
      if (incidentGroupOpenPeriod) {
        return (
          <Redirect
            to={`/organizations/${organization.slug}/issues/${incidentGroupOpenPeriod.groupId}/`}
          />
        );
      }
    }

    return <Component {...(props as any)} />;
  };
}
