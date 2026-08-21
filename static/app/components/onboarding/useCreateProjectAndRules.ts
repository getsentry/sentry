import {useIsMutating, useMutation, useMutationState} from '@tanstack/react-query';

import {useCreateProject} from 'sentry/components/onboarding/useCreateProject';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Project} from 'sentry/types/project';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import type {RequestDataFragment} from 'sentry/views/projectInstall/issueAlertOptions';
const MUTATION_KEY = 'create-project-and-rules';

type Variables = {
  alertRuleConfig: Partial<RequestDataFragment>;
  platform: OnboardingSelectedSDK;
  projectName: string;
  team?: string;
};

type Response = {
  project: Project;
};

export function useCreateProjectAndRules() {
  const createProject = useCreateProject();

  return useMutation<Response, RequestError, Variables>({
    mutationKey: [MUTATION_KEY],
    mutationFn: async ({projectName, platform, alertRuleConfig, team}) => {
      const project = await createProject.mutateAsync({
        name: projectName,
        platform,
        default_rules: alertRuleConfig?.defaultRules ?? true,
        firstTeamSlug: team,
      });

      return {project};
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
