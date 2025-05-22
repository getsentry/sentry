import {Project} from 'sentry/types/project';
import {useMutation} from 'sentry/utils/queryClient';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {RequestDataFragment} from 'sentry/views/projectInstall/issueAlertOptions';

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
