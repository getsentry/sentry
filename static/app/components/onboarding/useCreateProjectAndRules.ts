import {useCallback} from 'react';
import * as Sentry from '@sentry/react';
import {useIsMutating, useMutation, useMutationState} from '@tanstack/react-query';

import {removeProject} from 'sentry/actionCreators/projects';
import {useCreateProject} from 'sentry/components/onboarding/useCreateProject';
import {
  type CreatedProjectRule,
  useCreateProjectRules,
} from 'sentry/components/onboarding/useCreateProjectRules';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {defined} from 'sentry/utils/defined';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {useCreateNotificationAction} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import type {RequestDataFragment} from 'sentry/views/projectInstall/issueAlertOptions';
const MUTATION_KEY = 'create-project-and-rules';

type Variables = {
  alertRuleConfig: Partial<RequestDataFragment>;
  getIntegrationAction: ReturnType<
    typeof useCreateNotificationAction
  >['getIntegrationAction'];
  platform: OnboardingSelectedSDK;
  projectName: string;
  team?: string;
};

type Response = {
  project: Project;
  ruleIds: string[];
  notificationRule?: CreatedProjectRule;
};

function useRollbackProject() {
  const api = useApi();
  const organization = useOrganization();

  return useCallback(
    async (project: Project, workflowIds: string[]) => {
      Sentry.logger.error('Rolling back project', {
        projectToRollback: project,
        workflowsToRollback: workflowIds,
      });

      try {
        const workflowDeletionResults = await Promise.allSettled(
          workflowIds.map(workflowId =>
            api.requestPromise(
              getApiUrl('/organizations/$organizationIdOrSlug/workflows/$workflowId/', {
                path: {
                  organizationIdOrSlug: organization.slug,
                  workflowId,
                },
              }),
              {method: 'DELETE'}
            )
          )
        );
        const failedDeletion = workflowDeletionResults.find(
          result => result.status === 'rejected'
        );
        if (failedDeletion?.status === 'rejected') {
          throw failedDeletion.reason;
        }
      } catch (err) {
        Sentry.withScope(scope => {
          scope.setExtra('error', err);
          scope.setExtra('workflowIds', workflowIds);
          Sentry.captureMessage('Failed to rollback project alert workflows');
        });
      }

      try {
        await removeProject({
          api,
          orgSlug: organization.slug,
          projectSlug: project.slug,
          origin: 'getting_started',
        });
      } catch (err) {
        Sentry.withScope(scope => {
          scope.setExtra('error', err);
          Sentry.captureMessage('Failed to rollback project');
        });
      }
    },
    [api, organization.slug]
  );
}

export function useCreateProjectAndRules() {
  const createProject = useCreateProject();
  const createProjectRules = useCreateProjectRules();
  const rollbackProject = useRollbackProject();

  return useMutation<Response, RequestError, Variables>({
    mutationKey: [MUTATION_KEY],
    mutationFn: async ({
      projectName,
      platform,
      alertRuleConfig,
      team,
      getIntegrationAction,
    }) => {
      const integrationAction = getIntegrationAction({
        shouldCreateRule: alertRuleConfig?.shouldCreateRule,
      });
      const shouldCreateWorkflow = Boolean(
        alertRuleConfig?.shouldCreateCustomRule || integrationAction
      );
      const project = await createProject.mutateAsync({
        name: projectName,
        platform,
        // The server-created default workflow only contains email. When an
        // integration is selected, create the combined workflow below instead.
        default_rules: (alertRuleConfig?.defaultRules ?? true) && !integrationAction,
        firstTeamSlug: team,
      });
      const createdWorkflowIds: string[] = [];

      try {
        const createdRule = shouldCreateWorkflow
          ? createProjectRules
              .mutateAsync({
                projectId: project.id,
                name: project.name,
                conditions: alertRuleConfig?.conditions,
                isHighPriority:
                  (alertRuleConfig?.defaultRules ?? true) &&
                  !alertRuleConfig?.shouldCreateCustomRule,
                actions: [
                  ...(alertRuleConfig?.actions ?? []),
                  ...(integrationAction ? [integrationAction] : []),
                ],
                frequency: alertRuleConfig?.frequency,
              })
              .then(rule => {
                createdWorkflowIds.push(rule.id);
                return rule;
              })
          : undefined;
        const rule = await createdRule;
        const notificationRule = integrationAction ? rule : undefined;
        const ruleIds = [rule].filter(defined).map(created => created.id);

        return {project, notificationRule, ruleIds};
      } catch (error) {
        await rollbackProject(project, createdWorkflowIds);
        throw error;
      }
    },
  });
}

export function useIsCreatingProjectAndRules() {
  return Boolean(useIsMutating({mutationKey: [MUTATION_KEY]}));
}

export function useCreateProjectAndRulesError(): RequestError | undefined {
  const mutations = useMutationState<RequestError | undefined>({
    filters: {mutationKey: [MUTATION_KEY]},
    select: mutation => mutation.state.error as RequestError | undefined,
  });

  if (mutations.length === 0) {
    return undefined;
  }

  return mutations[mutations.length - 1] ?? undefined;
}
