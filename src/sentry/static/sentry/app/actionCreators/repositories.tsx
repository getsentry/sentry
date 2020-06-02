import * as Sentry from '@sentry/browser';

import RepositoryActions from 'app/actions/repositoryActions';
import {Client} from 'app/api';
import {Repository} from 'app/types';

type ParamsGet = {
  orgSlug: string;
};

export function getRepositories(api: Client, params: ParamsGet) {
  const {orgSlug} = params;
  const path = `/organizations/${orgSlug}/repos/`;

  RepositoryActions.loadRepositories(orgSlug);

  return api
    .requestPromise(path, {
      method: 'GET',
    })
    .then((res: Repository[]) => {
      RepositoryActions.loadRepositoriesSuccess(orgSlug, res);
    })
    .catch(err => {
      RepositoryActions.loadRepositoriesError(orgSlug, err);
      Sentry.withScope(scope => {
        scope.setLevel(Sentry.Severity.Warning);
        scope.setFingerprint(['getRepositories-action-creator']);
        Sentry.captureException(err);
      });
    });
}
