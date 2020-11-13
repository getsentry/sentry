import * as Sentry from '@sentry/react';

import {t} from 'app/locale';
import ReleaseActions from 'app/actions/releaseActions';
import {Client} from 'app/api';
import ReleaseStore, {getReleaseStoreKey} from 'app/stores/releaseStore';
import {Deploy, Release, ReleaseStatus} from 'app/types';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';

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

export function archiveRelease(api: Client, params: ParamsGet) {
  const {orgSlug, projectSlug, releaseVersion} = params;

  ReleaseActions.loadRelease(orgSlug, projectSlug, releaseVersion);
  addLoadingMessage(t('Archiving Release\u2026'));

  return api
    .requestPromise(`/organizations/${orgSlug}/releases/`, {
      method: 'POST',
      data: {
        status: ReleaseStatus.Archived,
        projects: [],
        version: releaseVersion,
      },
    })
    .then((release: Release) => {
      ReleaseActions.loadReleaseSuccess(projectSlug, releaseVersion, release);
      addSuccessMessage(t('Release was successfully archived.'));
    })
    .catch(error => {
      ReleaseActions.loadReleaseError(projectSlug, releaseVersion, error);
      addErrorMessage(
        error.responseJSON?.detail ?? t('Release could not be be archived.')
      );
      throw error;
    });
}

export function restoreRelease(api: Client, params: ParamsGet) {
  const {orgSlug, projectSlug, releaseVersion} = params;

  ReleaseActions.loadRelease(orgSlug, projectSlug, releaseVersion);
  addLoadingMessage(t('Restoring Release\u2026'));

  return api
    .requestPromise(`/organizations/${orgSlug}/releases/`, {
      method: 'POST',
      data: {
        status: ReleaseStatus.Active,
        projects: [],
        version: releaseVersion,
      },
    })
    .then((release: Release) => {
      ReleaseActions.loadReleaseSuccess(projectSlug, releaseVersion, release);
      addSuccessMessage(t('Release was successfully restored.'));
    })
    .catch(error => {
      ReleaseActions.loadReleaseError(projectSlug, releaseVersion, error);
      addErrorMessage(
        error.responseJSON?.detail ?? t('Release could not be be restored.')
      );
      throw error;
    });
}
