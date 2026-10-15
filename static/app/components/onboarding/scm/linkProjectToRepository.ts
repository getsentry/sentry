import * as Sentry from '@sentry/react';

import {apiFetch} from 'sentry/utils/api/apiFetch';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';

/**
 * Best-effort link of a repository to a freshly created project. Linking is
 * deliberately non-blocking: a failure is reported to Sentry but never stops
 * the flow, since the project itself was created successfully.
 */
export async function linkProjectToRepository({
  orgSlug,
  projectSlug,
  repositoryId,
}: {
  orgSlug: string;
  projectSlug: string;
  repositoryId: string;
}): Promise<void> {
  try {
    await apiFetch({
      queryKey: [
        getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/repo/', {
          path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: projectSlug},
        }),
        {method: 'POST', data: {repositoryId}},
      ],
    });
  } catch (error) {
    Sentry.captureException(error);
  }
}
