import LoadingIndicator from 'sentry/components/loadingIndicator';
import Redirect from 'sentry/components/redirect';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useUser} from 'sentry/utils/useUser';
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

/**
 * HoC that wraps a component to handle workflow engine
 * redirects for issue alert rules. Fetches workflow data if needed and
 * shows loading state while requests are in flight.
 */
function withRuleRedirect(
  Component: React.ComponentType<any>,
  makeRedirectPath: (workflowId: string, orgSlug: string) => string
) {
  return function WorkflowEngineRedirectWrapper(props: any) {
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

    return <Component {...props} />;
  };
}

/**
 * HoC that wraps a component to handle workflow engine
 * redirects for metric alert rules. Fetches detector data if needed and
 * shows loading state while requests are in flight.
 */
function withAlertRuleRedirect(
  Component: React.ComponentType<any>,
  makeRedirectPath: (detectorId: string, orgSlug: string) => string
) {
  return function WorkflowEngineRedirectWrapper(props: any) {
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

    return <Component {...props} />;
  };
}

export const withAutomationDetailsRedirect = (Component: React.ComponentType<any>) =>
  withRuleRedirect(Component, (workflowId, orgSlug) =>
    makeAutomationDetailsPathname(orgSlug, workflowId)
  );

export const withAutomationEditRedirect = (Component: React.ComponentType<any>) =>
  withRuleRedirect(Component, (workflowId, orgSlug) =>
    makeAutomationEditPathname(orgSlug, workflowId)
  );

export const withDetectorDetailsRedirect = (Component: React.ComponentType<any>) =>
  withAlertRuleRedirect(Component, (detectorId, orgSlug) =>
    makeMonitorDetailsPathname(orgSlug, detectorId)
  );

export const withDetectorEditRedirect = (Component: React.ComponentType<any>) =>
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

export function withDetectorCreateRedirect(Component: React.ComponentType<any>) {
  return function WorkflowEngineRedirectWrapper(props: any) {
    const user = useUser();
    const organization = useOrganization();
    const {alertType} = useParams();

    const shouldRedirect =
      !user.isStaff && organization.features.includes('workflow-engine-ui');

    if (shouldRedirect) {
      const detectorType = getDetectionType(alertType);
      const redirectPath = detectorType
        ? makeMonitorCreatePathname(organization.slug) + `?detectorType=${detectorType}`
        : makeMonitorCreatePathname(organization.slug);

      return <Redirect to={redirectPath} />;
    }

    return <Component {...props} />;
  };
}
