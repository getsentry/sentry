import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client, ResponseMeta} from 'sentry/api';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {Project} from 'sentry/types';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';

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

  promise.then(ProjectsStore.onUpdateSuccess).catch((error: ResponseMeta) => {
    const message = t('Unable to fetch project details');
    handleXhrErrorResponse(message, error);
    addErrorMessage(message);
  });

  return promise;
}
