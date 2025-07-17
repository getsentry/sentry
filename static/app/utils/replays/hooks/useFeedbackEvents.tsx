import type {FeedbackEvent} from 'sentry/utils/feedback/types';
import {useApiQueries} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export default function useFeedbackEvents({
  feedbackEventIds,
  projectId,
}: {
  feedbackEventIds: string[];
  projectId: string | undefined | null;
}) {
  const organization = useOrganization();

  const feedbackEventQuery = useApiQueries<FeedbackEvent>(
    feedbackEventIds.map((feedbackEventId: string) => [
      `/projects/${organization.slug}/${projectId}/events/${feedbackEventId}/`,
    ]),
    {
      staleTime: Infinity,
      enabled: Boolean(feedbackEventIds.length > 0 && projectId),
    }
  );

  const feedbackEvents = feedbackEventQuery
    .map(query => query.data)
    .filter(e => e !== undefined);
  const isPending = feedbackEventQuery.some(query => query.isPending);
  const isError = feedbackEventQuery.some(query => query.isError);

  return {
    feedbackEvents,
    isPending,
    isError,
  };
}
