import type {FeedbackEvent} from 'sentry/utils/feedback/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

// ideally, this would fetch many feedback events at once instead of just one
export default function useFeedbackEvent({
  feedbackId,
  projectId,
}: {
  feedbackId: string | undefined;
  projectId: string | undefined | null;
}) {
  const organization = useOrganization();

  const {data} = useApiQuery<FeedbackEvent>(
    [`/projects/${organization.slug}/${projectId}/events/${feedbackId}/`],
    {
      staleTime: 0,
      enabled: Boolean(feedbackId && projectId),
    }
  );
  return data;
}
