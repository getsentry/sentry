import * as Sentry from '@sentry/react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import ReleaseStore, {getReleaseStoreKey} from 'sentry/stores/releaseStore';
import {Deploy, Release, ReleaseStatus} from 'sentry/types';

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
  ReleaseStore.state.releaseLoading[getReleaseStoreKey(projectSlug, releaseVersion)] =
    true;
  ReleaseStore.loadRelease(orgSlug, projectSlug, releaseVersion);

  return api
    .requestPromise(path, {
      method: 'GET',
    })
    .then((res: Release) => {
      ReleaseStore.loadReleaseSuccess(projectSlug, releaseVersion, res);
    })
    .catch(err => {
      // This happens when a Project is not linked to a specific Release
      if (err.status === 404) {
        ReleaseStore.loadReleaseSuccess(projectSlug, releaseVersion, null);
        return;
      }

      ReleaseStore.loadReleaseError(projectSlug, releaseVersion, err);
      Sentry.withScope(scope => {
        scope.setLevel('warning');
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
  ReleaseStore.state.deploysLoading[getReleaseStoreKey(projectSlug, releaseVersion)] =
    true;
  ReleaseStore.loadDeploys(orgSlug, projectSlug, releaseVersion);

  return api
    .requestPromise(path, {
      method: 'GET',
    })
    .then((res: Deploy[]) => {
      ReleaseStore.loadDeploysSuccess(projectSlug, releaseVersion, res);
    })
    .catch(err => {
      // This happens when a Project is not linked to a specific Release
      if (err.status === 404) {
        ReleaseStore.loadDeploysSuccess(projectSlug, releaseVersion, null);
        return;
      }

      ReleaseStore.loadDeploysError(projectSlug, releaseVersion, err);
      Sentry.withScope(scope => {
        scope.setLevel('warning');
        scope.setFingerprint(['getReleaseDeploys-action-creator']);
        Sentry.captureException(err);
      });
    });
}

export function archiveRelease(api: Client, params: ParamsGet) {
  const {orgSlug, projectSlug, releaseVersion} = params;

  ReleaseStore.loadRelease(orgSlug, projectSlug, releaseVersion);
  addLoadingMessage(t('Archiving Release\u2026'));

  return api
    .requestPromise(`/organizations/${orgSlug}/releases/`, {
      method: 'POST',
      data: {
        status: ReleaseStatus.ARCHIVED,
        projects: [],
        version: releaseVersion,
      },
    })
    .then((release: Release) => {
      ReleaseStore.loadReleaseSuccess(projectSlug, releaseVersion, release);
      addSuccessMessage(t('Release was successfully archived.'));
    })
    .catch(error => {
      ReleaseStore.loadReleaseError(projectSlug, releaseVersion, error);
      addErrorMessage(
        error.responseJSON?.detail ?? t('Release could not be be archived.')
      );
      throw error;
    });
}

export function restoreRelease(api: Client, params: ParamsGet) {
  const {orgSlug, projectSlug, releaseVersion} = params;

  ReleaseStore.loadRelease(orgSlug, projectSlug, releaseVersion);
  addLoadingMessage(t('Restoring Release\u2026'));

  return api
    .requestPromise(`/organizations/${orgSlug}/releases/`, {
      method: 'POST',
      data: {
        status: ReleaseStatus.ACTIVE,
        projects: [],
        version: releaseVersion,
      },
    })
    .then((release: Release) => {
      ReleaseStore.loadReleaseSuccess(projectSlug, releaseVersion, release);
      addSuccessMessage(t('Release was successfully restored.'));
    })
    .catch(error => {
      ReleaseStore.loadReleaseError(projectSlug, releaseVersion, error);
      addErrorMessage(
        error.responseJSON?.detail ?? t('Release could not be be restored.')
      );
      throw error;
    });
}
