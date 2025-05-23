import {useCreateProject} from 'sentry/components/onboarding/useCreateProject';
import {useCreateProjectRules} from 'sentry/components/onboarding/useCreateProjectRules';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {useIsMutating, useMutation} from 'sentry/utils/queryClient';
import type {useCreateNotificationAction} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import type {RequestDataFragment} from 'sentry/views/projectInstall/issueAlertOptions';

const MUTATION_KEY = 'create-project-and-rules';

export function useCreateProjectAndRules() {
  const createProject = useCreateProject();
  const createProjectRules = useCreateProjectRules();

  return useMutation({
    mutationKey: [MUTATION_KEY],
    mutationFn: async ({
      projectName,
      platform,
      alertRuleConfig,
      team,
      createNotificationAction,
    }: {
      alertRuleConfig: Partial<RequestDataFragment>;
      createNotificationAction: ReturnType<
        typeof useCreateNotificationAction
      >['createNotificationAction'];
      platform: OnboardingSelectedSDK;
      projectName: string;
      team?: string;
    }) => {
      const project = await createProject.mutateAsync({
        name: projectName,
        platform,
        default_rules: alertRuleConfig?.defaultRules ?? true,
        firstTeamSlug: team,
      });

      const notificationRule = await createNotificationAction({
        shouldCreateRule: alertRuleConfig?.shouldCreateRule,
        name: project.name,
        projectSlug: project.slug,
        conditions: alertRuleConfig?.conditions,
        actionMatch: alertRuleConfig?.actionMatch,
        frequency: alertRuleConfig?.frequency,
      });

      if (alertRuleConfig?.shouldCreateCustomRule) {
        const customRule = await createProjectRules.mutateAsync({
          projectSlug: project.slug,
          name: project.name,
          conditions: alertRuleConfig?.conditions,
          actions: alertRuleConfig?.actions,
          actionMatch: alertRuleConfig?.actionMatch,
          frequency: alertRuleConfig?.frequency,
        });

        return {
          project,
          customRule,
          notificationRule,
        };
      }

      return {
        project,
        notificationRule,
      };
    },
  });
}

export function useIsCreatingProjectAndRules() {
  return Boolean(useIsMutating({mutationKey: [MUTATION_KEY]}));
}
