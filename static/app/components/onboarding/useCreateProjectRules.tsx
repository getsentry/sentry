import type {Project} from 'sentry/types/project';
import {useIsMutating, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {RequestDataFragment} from 'sentry/views/projectInstall/issueAlertOptions';

const MUTATION_KEY = 'create-project-rules';

interface Variables
  extends Partial<
    Pick<
      RequestDataFragment,
      'conditions' | 'actions' | 'actionMatch' | 'frequency' | 'name'
    >
  > {
  projectSlug: string;
}

export function useCreateProjectRules() {
  const api = useApi();
  const organization = useOrganization();

  return useMutation<Project, RequestError, Variables>({
    mutationKey: [MUTATION_KEY],
    mutationFn: ({projectSlug, name, conditions, actions, actionMatch, frequency}) => {
      return api.requestPromise(`/projects/${organization.slug}/${projectSlug}/rules/`, {
        method: 'POST',
        data: {
          name,
          conditions,
          actions,
          actionMatch,
          frequency,
        },
      });
    },
  });
}

export function useIsCreatingProjectRules() {
  return Boolean(useIsMutating({mutationKey: [MUTATION_KEY]}));
}
