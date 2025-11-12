import {useCallback} from 'react';
import * as Sentry from '@sentry/react';

import {removeProject} from 'sentry/actionCreators/projects';
import {useCreateProject} from 'sentry/components/onboarding/useCreateProject';
import {useCreateProjectRules} from 'sentry/components/onboarding/useCreateProjectRules';
import type {IssueAlertRule} from 'sentry/types/alerts';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {useIsMutating, useMutation, useMutationState} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {useCreateNotificationAction} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import type {RequestDataFragment} from 'sentry/views/projectInstall/issueAlertOptions';

const MUTATION_KEY = 'create-project-and-rules';

type Variables = {
  alertRuleConfig: Partial<RequestDataFragment>;
  createNotificationAction: ReturnType<
    typeof useCreateNotificationAction
  >['createNotificationAction'];
  platform: OnboardingSelectedSDK;
  projectName: string;
  team?: string;
};

type Response = {
  project: Project;
  ruleIds: string[];
  notificationRule?: IssueAlertRule;
};

function useRollbackProject() {
  const api = useApi();
  const organization = useOrganization();

  return useCallback(
    async (project: Project) => {
      Sentry.logger.error('Rolling back project', {
        projectToRollback: project,
      });

      try {
        // Rolling back the project also deletes its associated alert rules
        // due to the cascading delete constraint.
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
      createNotificationAction,
    }) => {
      const project = await createProject.mutateAsync({
        name: projectName,
        platform,
        default_rules: alertRuleConfig?.defaultRules ?? true,
        firstTeamSlug: team,
      });

      try {
        const customRulePromise = alertRuleConfig?.shouldCreateCustomRule
          ? createProjectRules.mutateAsync({
              projectSlug: project.slug,
              name: project.name,
              conditions: alertRuleConfig?.conditions,
              actions: alertRuleConfig?.actions,
              actionMatch: alertRuleConfig?.actionMatch,
              frequency: alertRuleConfig?.frequency,
            })
          : undefined;

        const notificationRulePromise = createNotificationAction({
          shouldCreateRule: alertRuleConfig?.shouldCreateRule,
          name: project.name,
          projectSlug: project.slug,
          conditions: alertRuleConfig?.conditions,
          actionMatch: alertRuleConfig?.actionMatch,
          frequency: alertRuleConfig?.frequency,
        });

        const [customRule, notificationRule] = await Promise.all([
          customRulePromise,
          notificationRulePromise,
        ]);

        const ruleIds = [customRule, notificationRule]
          .filter(defined)
          .map(rule => rule.id);

        return {project, notificationRule, ruleIds};
      } catch (error) {
        await rollbackProject(project);
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
