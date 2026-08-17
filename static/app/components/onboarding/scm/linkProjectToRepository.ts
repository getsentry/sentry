import * as Sentry from '@sentry/react';

import {fetchMutation} from 'sentry/utils/queryClient';

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
    await fetchMutation({
      url: `/projects/${orgSlug}/${projectSlug}/repo/`,
      method: 'POST',
      data: {repositoryId},
    });
  } catch (error) {
    Sentry.captureException(error);
  }
}
