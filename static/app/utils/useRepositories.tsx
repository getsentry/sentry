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
} & useRequestResult;

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
    results => RepositoryActions.loadRepositoriesSuccess(results),
    err => RepositoryActions.loadRepositoriesError(err)
  );

  useEffect(() => {
    /** Multiple components may call useRepositories.
     * We want to prevent making multiple calls for the same org.
     *
     * HACK(leedongwei & nisanthan): Actions fired by the ActionCreators are queued to the back of the event loop, allowing another getRepo for the same repo to be fired before the loading state is updated in store. We will directly manipulate the state of the store, rather than wait for the ActionCreator.
     * This hack short-circuits that and update the state immediately.
     *
     * */
    if (
      orgId !== store.orgSlug &&
      orgId !== undefined &&
      !RepositoryStore.state.repositoriesLoading
    ) {
      RepositoryActions.loadRepositories(orgId);
      RepositoryStore.state.repositoriesLoading = true;
      get();
    }
  }, [orgId]);

  const result: Result = {
    ...rest,
    get,
    repositories: store.repositories,
    loading: store.repositoriesLoading,
  };

  return result;
}

export default useRepositories;
