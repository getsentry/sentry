import * as Sentry from '@sentry/react';

import {Client} from 'sentry/api';
import RepositoryStore from 'sentry/stores/repositoryStore';
import {Repository} from 'sentry/types';

type ParamsGet = {
  orgSlug: string;
};

export function getRepositories(api: Client, params: ParamsGet) {
  const {orgSlug} = params;
  const path = `/organizations/${orgSlug}/repos/`;

  // HACK(leedongwei): Actions fired by the ActionCreators are queued to
  // the back of the event loop, allowing another getRepo for the same
  // repo to be fired before the loading state is updated in store.
  // This hack short-circuits that and update the state immediately.
  RepositoryStore.state.repositoriesLoading = true;
  RepositoryStore.loadRepositories(orgSlug);

  return api
    .requestPromise(path, {
      method: 'GET',
    })
    .then((res: Repository[]) => {
      RepositoryStore.loadRepositoriesSuccess(res);
    })
    .catch(err => {
      RepositoryStore.loadRepositoriesError(err);
      Sentry.withScope(scope => {
        scope.setLevel('warning');
        scope.setFingerprint(['getRepositories-action-creator']);
        Sentry.captureException(err);
      });
    });
}
