import LoadingIndicator from 'sentry/components/loadingIndicator';
import Redirect from 'sentry/components/redirect';
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
        `/organizations/${organization.slug}/alert-rule-workflow/`,
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
        `/organizations/${organization.slug}/alert-rule-detector/`,
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
    const shouldRedirect =
      (!hasRedirectOptOut ||
        // When clicking from a notification, we never want to opt out of the redirect
        !!notificationUuid) &&
      hasWorkflowEngineUI;

    // Check for incident open period if alertId is present
    const {data: incidentGroupOpenPeriod, isPending: isOpenPeriodPending} =
      useApiQuery<IncidentGroupOpenPeriod>(
        [
          `/organizations/${organization.slug}/incident-groupopenperiod/`,
          {query: {incident_identifier: alertId}},
        ],
        {
          staleTime: 0,
          enabled: shouldRedirect && !!alertId,
          retry: false,
        }
      );

    // Check for detector if no alertId
    const {data: alertRuleDetector, isPending: isDetectorPending} =
      useApiQuery<AlertRuleDetector>(
        [
          `/organizations/${organization.slug}/alert-rule-detector/`,
          {query: {alert_rule_id: ruleId}},
        ],
        {
          staleTime: 0,
          enabled: shouldRedirect && !!ruleId && !detectorId && !alertId,
          retry: false,
        }
      );

    if (shouldRedirect) {
      // If alertId is provided, redirect to metric issue
      if (alertId) {
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
      }

      // If detectorId is provided, redirect to monitor details
      if (detectorId) {
        return (
          <Redirect to={makeMonitorDetailsPathname(organization.slug, detectorId)} />
        );
      }

      // If alertRuleId is provided, fetch detector and redirect
      if (isDetectorPending) {
        return <LoadingIndicator />;
      }
      if (alertRuleDetector) {
        return (
          <Redirect
            to={makeMonitorDetailsPathname(
              organization.slug,
              alertRuleDetector.detectorId
            )}
          />
        );
      }
    }

    return <Component {...(props as any)} />;
  };
};

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
          `/organizations/${organization.slug}/incident-groupopenperiod/`,
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
