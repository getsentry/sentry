import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {ReleaseStatus} from 'sentry/types/release';

type ParamsGet = {
  orgSlug: string;
  projectSlug: string;
  releaseVersion: string;
};

export function archiveRelease(api: Client, params: ParamsGet) {
  const {orgSlug, releaseVersion} = params;

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
    .then(() => {
      addSuccessMessage(t('Release was successfully archived.'));
    })
    .catch(error => {
      addErrorMessage(
        error.responseJSON?.detail ?? t('Release could not be be archived.')
      );
      throw error;
    });
}

export function restoreRelease(api: Client, params: ParamsGet) {
  const {orgSlug, releaseVersion} = params;

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
    .then(() => {
      addSuccessMessage(t('Release was successfully restored.'));
    })
    .catch(error => {
      addErrorMessage(
        error.responseJSON?.detail ?? t('Release could not be be restored.')
      );
      throw error;
    });
}
