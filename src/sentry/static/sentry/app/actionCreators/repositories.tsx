import * as Sentry from '@sentry/react';

import RepositoryActions from 'app/actions/repositoryActions';
import {Client} from 'app/api';
import RepositoryStore from 'app/stores/repositoryStore';
import {Repository} from 'app/types';

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
  RepositoryActions.loadRepositories(orgSlug);

  return api
    .requestPromise(path, {
      method: 'GET',
    })
    .then((res: Repository[]) => {
      RepositoryActions.loadRepositoriesSuccess(res);
    })
    .catch(err => {
      RepositoryActions.loadRepositoriesError(err);
      Sentry.withScope(scope => {
        scope.setLevel(Sentry.Severity.Warning);
        scope.setFingerprint(['getRepositories-action-creator']);
        Sentry.captureException(err);
      });
    });
}
