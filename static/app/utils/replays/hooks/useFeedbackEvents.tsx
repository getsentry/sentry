import type {FeedbackEvent} from 'sentry/utils/feedback/types';
import {useApiQueries} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export default function useFeedbackEvents({
  feedbackIds,
  projectId,
}: {
  feedbackIds: string[];
  projectId: string | undefined | null;
}) {
  const organization = useOrganization();

  const feedbackEventQuery = useApiQueries<FeedbackEvent[]>(
    feedbackIds.map((feedbackId: string) => [
      `/projects/${organization.slug}/${projectId}/events/${feedbackId}/`,
    ]),
    {
      staleTime: 0,
      enabled: Boolean(feedbackIds.length > 0 && projectId),
    }
  );

  return feedbackEventQuery[0]?.data;
}
