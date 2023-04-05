import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {Project} from 'sentry/types';

/**
 * Fetches a project's details
 */
export function fetchProjectDetails({
  api,
  orgSlug,
  projSlug,
}: {
  api: Client;
  orgSlug: string;
  projSlug: string;
}): Promise<Project> {
  const promise = api.requestPromise(`/projects/${orgSlug}/${projSlug}/`);

  promise.then(ProjectsStore.onUpdateSuccess).catch(error => {
    const message = t('Unable to fetch project details');
    addErrorMessage(message);
    Sentry.captureException(error);
  });

  return promise;
}
