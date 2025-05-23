import type {IssueAlertRule} from 'sentry/types/alerts';
import {useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export interface CreateProjectRulesVariables
  extends Partial<
    Pick<IssueAlertRule, 'conditions' | 'actions' | 'actionMatch' | 'frequency' | 'name'>
  > {
  projectSlug: string;
}

export function useCreateProjectRules() {
  const api = useApi();
  const organization = useOrganization();
  return useMutation<IssueAlertRule, RequestError, CreateProjectRulesVariables>({
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
