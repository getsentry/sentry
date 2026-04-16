import {skipToken, useQueries} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {FeedbackEvent} from 'sentry/utils/feedback/types';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useFeedbackEvents({
  feedbackEventIds,
  projectId,
}: {
  feedbackEventIds: string[];
  projectId: string | undefined | null;
}) {
  const organization = useOrganization();

  return useQueries({
    queries: feedbackEventIds.map((feedbackEventId: string) =>
      apiOptions.as<FeedbackEvent>()(
        '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/',
        {
          path: projectId
            ? {
                organizationIdOrSlug: organization.slug,
                projectIdOrSlug: projectId,
                eventId: feedbackEventId,
              }
            : skipToken,
          staleTime: Infinity,
        }
      )
    ),
    combine: results => ({
      feedbackEvents: results.map(r => r.data).filter(e => e !== undefined),
      isPending: results.some(r => r.isPending),
      isError: results.some(r => r.isError),
    }),
  });
}
