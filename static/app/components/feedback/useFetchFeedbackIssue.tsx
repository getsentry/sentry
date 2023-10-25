import hydrateEventTags from 'sentry/components/feedback/hydrateEventTags';
import hydrateFeedbackRecord from 'sentry/components/feedback/hydrateFeedbackRecord';
import {Event, Organization} from 'sentry/types';
import {RawFeedbackItemResponse} from 'sentry/utils/feedback/item/types';
import {useApiQuery, type UseApiQueryOptions} from 'sentry/utils/queryClient';

interface Props {
  feedbackId: string;
  organization: Organization;
}

export default function useFetchFeedbackIssue(
  {feedbackId, organization}: Props,
  options: undefined | Partial<UseApiQueryOptions<RawFeedbackItemResponse>> = {}
) {
  const {data: issueData, ...issueResult} = useApiQuery<RawFeedbackItemResponse>(
    [
      `/organizations/${organization.slug}/issues/${feedbackId}/`,
      {
        query: {
          collapse: ['release', 'tags'],
          expand: ['inbox', 'owners'],
        },
      },
    ],
    {
      staleTime: 0,
      ...options,
    }
  );

  const {data: eventData, ...eventResult} = useApiQuery<Event>(
    [`/organizations/${organization.slug}/issues/${feedbackId}/events/latest/`],
    {
      staleTime: 0,
    }
  );

  return {
    issueData: issueData ? hydrateFeedbackRecord(issueData) : undefined,
    replayId: eventData?.contexts?.feedback?.replay_id,
    eventData,
    tags: hydrateEventTags(eventData),
    eventResult,
    ...issueResult,
  };
}
