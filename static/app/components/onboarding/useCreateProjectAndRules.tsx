import {useCreateProject} from 'sentry/components/onboarding/useCreateProject';
import {useCreateProjectRules} from 'sentry/components/onboarding/useCreateProjectRules';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {useIsMutating, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
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
};

export function useCreateProjectAndRules() {
  const createProject = useCreateProject();
  const createProjectRules = useCreateProjectRules();

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

      const ruleIds = [];

      if (alertRuleConfig?.shouldCreateCustomRule) {
        const ruleData = await createProjectRules.mutateAsync({
          projectSlug: project.slug,
          name: project.name,
          conditions: alertRuleConfig?.conditions,
          actions: alertRuleConfig?.actions,
          actionMatch: alertRuleConfig?.actionMatch,
          frequency: alertRuleConfig?.frequency,
        });

        ruleIds.push(ruleData.id);
      }

      const notificationRule = await createNotificationAction({
        shouldCreateRule: alertRuleConfig?.shouldCreateRule,
        name: project.name,
        projectSlug: project.slug,
        conditions: alertRuleConfig?.conditions,
        actionMatch: alertRuleConfig?.actionMatch,
        frequency: alertRuleConfig?.frequency,
      });

      ruleIds.push(notificationRule?.id);

      return {project, ruleIds: ruleIds.filter(defined)};
    },
  });
}

export function useIsCreatingProjectAndRules() {
  return Boolean(useIsMutating({mutationKey: [MUTATION_KEY]}));
}
