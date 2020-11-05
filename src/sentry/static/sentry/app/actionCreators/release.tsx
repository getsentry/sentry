import * as Sentry from '@sentry/react';

import ReleaseActions from 'app/actions/releaseActions';
import {Client} from 'app/api';
import ReleaseStore, {getReleaseStoreKey} from 'app/stores/releaseStore';
import {Deploy, Release} from 'app/types';

type ParamsGet = {
  orgSlug: string;
  projectSlug: string;
  releaseVersion: string;
};

export function getProjectRelease(api: Client, params: ParamsGet) {
  const {orgSlug, projectSlug, releaseVersion} = params;
  const path = `/projects/${orgSlug}/${projectSlug}/releases/${encodeURIComponent(
    releaseVersion
  )}/`;
  // HACK(leedongwei): Actions fired by the ActionCreators are queued to
  // the back of the event loop, allowing another getRelease for the same
  // release to be fired before the loading state is updated in store.
  // This hack short-circuits that and update the state immediately.
  ReleaseStore.state.releaseLoading[
    getReleaseStoreKey(projectSlug, releaseVersion)
  ] = true;
  ReleaseActions.loadRelease(orgSlug, projectSlug, releaseVersion);

  return api
    .requestPromise(path, {
      method: 'GET',
    })
    .then((res: Release) => {
      ReleaseActions.loadReleaseSuccess(projectSlug, releaseVersion, res);
    })
    .catch(err => {
      // This happens when a Project is not linked to a specific Release
      if (err.status === 404) {
        ReleaseActions.loadReleaseSuccess(projectSlug, releaseVersion, null);
        return;
      }

      ReleaseActions.loadReleaseError(projectSlug, releaseVersion, err);
      Sentry.withScope(scope => {
        scope.setLevel(Sentry.Severity.Warning);
        scope.setFingerprint(['getRelease-action-creator']);
        Sentry.captureException(err);
      });
    });
}

export function getReleaseDeploys(api: Client, params: ParamsGet) {
  const {orgSlug, projectSlug, releaseVersion} = params;
  const path = `/organizations/${orgSlug}/releases/${encodeURIComponent(
    releaseVersion
  )}/deploys/`;

  // HACK(leedongwei): Same as above
  ReleaseStore.state.deploysLoading[
    getReleaseStoreKey(projectSlug, releaseVersion)
  ] = true;
  ReleaseActions.loadDeploys(orgSlug, projectSlug, releaseVersion);

  return api
    .requestPromise(path, {
      method: 'GET',
    })
    .then((res: Deploy[]) => {
      ReleaseActions.loadDeploysSuccess(projectSlug, releaseVersion, res);
    })
    .catch(err => {
      // This happens when a Project is not linked to a specific Release
      if (err.status === 404) {
        ReleaseActions.loadDeploysSuccess(projectSlug, releaseVersion, null);
        return;
      }

      ReleaseActions.loadDeploysError(projectSlug, releaseVersion, err);
      Sentry.withScope(scope => {
        scope.setLevel(Sentry.Severity.Warning);
        scope.setFingerprint(['getReleaseDeploys-action-creator']);
        Sentry.captureException(err);
      });
    });
}
