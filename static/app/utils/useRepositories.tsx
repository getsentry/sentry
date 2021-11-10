import {useEffect} from 'react';

import RepositoryActions from 'app/actions/repositoryActions';
import OrganizationStore from 'app/stores/organizationStore';
import RepositoryStore from 'app/stores/repositoryStore';
import {useLegacyStore} from 'app/stores/useLegacyStore';
import {Repository} from 'app/types';
import useRequest, {Result as useRequestResult} from 'app/utils/useRequest';

export type Result = {
  /**
   * The loaded repositories list
   */
  repositories: Repository[];
} & Omit<useRequestResult, 'data'>;

type Options = {
  /**
   * Number of repositories to return
   */
  limit?: number;
};

/**
 * Provides repositories from the RepositoryStore
 */
function useRepositories({limit}: Options = {}) {
  const {organization} = useLegacyStore(OrganizationStore);
  const store = useLegacyStore(RepositoryStore);

  const orgId = organization?.slug;

  if (store.orgSlug && store.orgSlug !== orgId) {
    RepositoryActions.resetRepositories();
  }

  const {get, ...rest} = useRequest(
    `/organizations/${orgId}/repos/`,
    {
      limit,
    },
    data => RepositoryActions.loadRepositoriesSuccess(data)
  );

  useEffect(() => {
    /** Multiple components may call useRepositories.
     * We want to prevent making multiple calls for the same org. */
    if (orgId !== store.orgSlug && orgId !== undefined) {
      get();
    }
  }, [orgId]);

  const result: Result = {
    repositories: store.repositories,
    get,
    ...rest,
  };

  return result;
}

export default useRepositories;
