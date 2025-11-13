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

interface AlertRuleWorkflow {
  alertRuleId: string | null;
  ruleId: string | null;
  workflowId: string;
}

/**
 * Base component for workflow engine redirects that conditionally redirects
 * users based on feature flags.
 */
function WorkflowEngineRedirect({
  children,
  redirectTo,
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

  return children;
}

/**
 * Base component for workflow engine redirects that require fetching
 * workflow data from a rule before redirecting.
 */
function WorkflowEngineRedirectWithData({
  children,
  makeRedirectPath,
}: {
  children: React.ReactNode;
  makeRedirectPath: (workflowId: string, orgSlug: string) => string;
}) {
  const user = useUser();
  const organization = useOrganization();
  const params = useParams<{projectId: string; ruleId: string}>();
  const {ruleId} = params;

  const shouldRedirect =
    !user.isStaff && organization.features.includes('workflow-engine-ui');

  const {data: alertRuleWorkflow, isPending} = useApiQuery<AlertRuleWorkflow>(
    [
      `/organizations/${organization.slug}/alert-rule-workflow/`,
      {query: {rule_id: ruleId}},
    ],
    {
      staleTime: 0,
      enabled: shouldRedirect,
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

  return children;
}

// Simple static redirects

export function WorkflowEngineRedirectToAutomationList({
  children,
}: {
  children: React.ReactNode;
}) {
  const organization = useOrganization();
  return (
    <WorkflowEngineRedirect redirectTo={makeAutomationBasePathname(organization.slug)}>
      {children}
    </WorkflowEngineRedirect>
  );
}

// Data-dependent redirects

export function WorkflowEngineRedirectToAutomationDetails({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkflowEngineRedirectWithData
      makeRedirectPath={(workflowId, orgSlug) =>
        makeAutomationDetailsPathname(orgSlug, workflowId)
      }
    >
      {children}
    </WorkflowEngineRedirectWithData>
  );
}

export function WorkflowEngineRedirectToAutomationEdit({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkflowEngineRedirectWithData
      makeRedirectPath={(workflowId, orgSlug) =>
        makeAutomationEditPathname(orgSlug, workflowId)
      }
    >
      {children}
    </WorkflowEngineRedirectWithData>
  );
}
