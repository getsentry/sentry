import * as Sentry from '@sentry/browser';

import ReleaseActions from 'app/actions/releaseActions';
import {Client} from 'app/api';
import {Deploy, Release} from 'app/types';

type ParamsGet = {
  orgSlug: string;
  projectSlug: string;
  releaseVersion: string;
};

export function getRelease(api: Client, params: ParamsGet) {
  const {orgSlug, projectSlug, releaseVersion} = params;
  const path = `/projects/${orgSlug}/${projectSlug}/releases/${encodeURIComponent(
    releaseVersion
  )}/`;

  ReleaseActions.loadRelease(orgSlug, projectSlug, releaseVersion);

  return api
    .requestPromise(path, {
      method: 'GET',
    })
    .then((res: Release) => {
      ReleaseActions.loadReleaseSuccess(projectSlug, releaseVersion, res);
    })
    .catch(err => {
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

  ReleaseActions.loadDeploys(orgSlug, projectSlug, releaseVersion);

  return api
    .requestPromise(path, {
      method: 'GET',
    })
    .then((res: Deploy[]) => {
      ReleaseActions.loadDeploysSuccess(projectSlug, releaseVersion, res);
    })
    .catch(err => {
      ReleaseActions.loadDeploysError(projectSlug, releaseVersion, err);
      Sentry.withScope(scope => {
        scope.setLevel(Sentry.Severity.Warning);
        scope.setFingerprint(['getReleaseDeploys-action-creator']);
        Sentry.captureException(err);
      });
    });
}
