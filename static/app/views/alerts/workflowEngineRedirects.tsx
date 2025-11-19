import {cloneElement, isValidElement} from 'react';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import Redirect from 'sentry/components/redirect';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useUser} from 'sentry/utils/useUser';
import {
  makeAutomationBasePathname,
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

/**
 * Base component for workflow engine redirects that conditionally redirects
 * users based on feature flags.
 */
function WorkflowEngineRedirect({
  children,
  redirectTo,
  ...props
}: {
  children: React.ReactNode;
  redirectTo: string;
}) {
  const user = useUser();
  const organization = useOrganization();

  const shouldRedirect =
    !user.isStaff && organization.features.includes('workflow-engine-ui');

  if (shouldRedirect) {
    return <Redirect to={redirectTo} />;
  }

  // Pass through all props to children
  if (isValidElement(children)) {
    return cloneElement(children, props);
  }

  return children;
}

/**
 * Base component for workflow engine redirects that require fetching
 * workflow data from an issue alert rule before redirecting.
 */
function WorkflowEngineRedirectWithRuleData({
  children,
  makeRedirectPath,
  ...props
}: {
  children: React.ReactNode;
  makeRedirectPath: (workflowId: string, orgSlug: string) => string;
}) {
  const user = useUser();
  const organization = useOrganization();
  const {ruleId} = useParams();

  const shouldRedirect =
    !user.isStaff && organization.features.includes('workflow-engine-ui');

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

  // Pass through all props to children
  if (isValidElement(children)) {
    return cloneElement(children, props);
  }

  return children;
}

/**
 * Base component for workflow engine redirects that require fetching
 * workflow data from a metric alert rule before redirecting.
 */
function WorkflowEngineRedirectWithAlertRuleData({
  children,
  makeRedirectPath,
  ...props
}: {
  children: React.ReactNode;
  makeRedirectPath: (detectorId: string, orgSlug: string) => string;
}) {
  const user = useUser();
  const organization = useOrganization();
  const {ruleId, detectorId} = useParams();

  const shouldRedirect =
    !user.isStaff && organization.features.includes('workflow-engine-ui');

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

  // Pass through all props to children
  if (isValidElement(children)) {
    return cloneElement(children, props);
  }

  return children;
}

// Simple static redirects

export function WorkflowEngineRedirectToAutomationList({
  children,
  ...props
}: {
  children: React.ReactNode;
}) {
  const organization = useOrganization();
  return (
    <WorkflowEngineRedirect
      redirectTo={makeAutomationBasePathname(organization.slug)}
      {...props}
    >
      {children}
    </WorkflowEngineRedirect>
  );
}

export function WorkflowEngineRedirectToDetectorCreate({
  children,
  ...props
}: {
  children: React.ReactNode;
}) {
  const organization = useOrganization();

  const {alertType} = useParams();
  const detectorType =
    alertType === 'crons'
      ? 'monitor_check_in_failure'
      : alertType === 'uptime'
        ? 'uptime_domain_failure'
        : null;

  const redirectPath = detectorType
    ? makeMonitorCreatePathname(organization.slug) + `?detectorType=${detectorType}`
    : makeMonitorCreatePathname(organization.slug);

  return (
    <WorkflowEngineRedirect redirectTo={redirectPath} {...props}>
      {children}
    </WorkflowEngineRedirect>
  );
}

// Data-dependent redirects for issue rules (with projectId)

export function WorkflowEngineRedirectToAutomationDetails({
  children,
  ...props
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkflowEngineRedirectWithRuleData
      makeRedirectPath={(workflowId, orgSlug) =>
        makeAutomationDetailsPathname(orgSlug, workflowId)
      }
      {...props}
    >
      {children}
    </WorkflowEngineRedirectWithRuleData>
  );
}

export function WorkflowEngineRedirectToAutomationEdit({
  children,
  ...props
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkflowEngineRedirectWithRuleData
      makeRedirectPath={(workflowId, orgSlug) =>
        makeAutomationEditPathname(orgSlug, workflowId)
      }
      {...props}
    >
      {children}
    </WorkflowEngineRedirectWithRuleData>
  );
}

// Data-dependent redirects for alert rules

export function WorkflowEngineRedirectToDetectorDetails({
  children,
  ...props
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkflowEngineRedirectWithAlertRuleData
      makeRedirectPath={(detectorId, orgSlug) =>
        makeMonitorDetailsPathname(orgSlug, detectorId)
      }
      {...props}
    >
      {children}
    </WorkflowEngineRedirectWithAlertRuleData>
  );
}

export function WorkflowEngineRedirectToDetectorEdit({
  children,
  ...props
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkflowEngineRedirectWithAlertRuleData
      makeRedirectPath={(detectorId, orgSlug) =>
        makeMonitorEditPathname(orgSlug, detectorId)
      }
      {...props}
    >
      {children}
    </WorkflowEngineRedirectWithAlertRuleData>
  );
}
