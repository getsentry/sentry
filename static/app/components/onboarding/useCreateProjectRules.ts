import {useMutation} from '@tanstack/react-query';

import type {IssueAlertRule} from 'sentry/types/alerts';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {RequestDataFragment} from 'sentry/views/projectInstall/issueAlertOptions';
interface Variables extends Partial<
  Pick<
    RequestDataFragment,
    'conditions' | 'actions' | 'actionMatch' | 'frequency' | 'name'
  >
> {
  projectSlug: string;
}

export function useCreateProjectRules() {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  return useMutation<IssueAlertRule, RequestError, Variables>({
    mutationFn: ({projectSlug, name, conditions, actions, actionMatch, frequency}) => {
      return api.requestPromise(
        getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/rules/', {
          path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: projectSlug},
        }),
        {
          method: 'POST',
          data: {
            name,
            conditions,
            actions,
            actionMatch,
            frequency,
          },
        }
      );
    },
  });
}
