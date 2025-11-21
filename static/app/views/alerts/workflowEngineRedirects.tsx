import {cloneElement, isValidElement} from 'react';

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

interface AlertRuleWorkflow {
  alertRuleId: string | null;
  ruleId: string | null;
  workflowId: string;
}

/**
 * Base component for workflow engine redirects that require fetching
 * workflow data from a rule before redirecting.
 */
function WorkflowEngineRedirectWithData({
  children,
  makeRedirectPath,
  ...props
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

  // Pass through all props to children
  if (isValidElement(children)) {
    return cloneElement(children, props);
  }

  return children;
}

// Data-dependent redirects

export function WorkflowEngineRedirectToAutomationDetails({
  children,
  ...props
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkflowEngineRedirectWithData
      makeRedirectPath={(workflowId, orgSlug) =>
        makeAutomationDetailsPathname(orgSlug, workflowId)
      }
      {...props}
    >
      {children}
    </WorkflowEngineRedirectWithData>
  );
}

export function WorkflowEngineRedirectToAutomationEdit({
  children,
  ...props
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkflowEngineRedirectWithData
      makeRedirectPath={(workflowId, orgSlug) =>
        makeAutomationEditPathname(orgSlug, workflowId)
      }
      {...props}
    >
      {children}
    </WorkflowEngineRedirectWithData>
  );
}
