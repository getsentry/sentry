import {useMemo} from 'react';

import hydrateEventTags from 'sentry/components/feedback/hydrateEventTags';
import {Organization} from 'sentry/types';
import {FeedbackEvent, FeedbackIssue} from 'sentry/utils/feedback/types';
import {useApiQuery, type UseApiQueryOptions} from 'sentry/utils/queryClient';

interface Props {
  feedbackId: string;
  organization: Organization;
}

export default function useFetchFeedbackData(
  {feedbackId, organization}: Props,
  options: undefined | Partial<UseApiQueryOptions<FeedbackIssue>> = {}
) {
  const {data: issueData, ...issueResult} = useApiQuery<FeedbackIssue>(
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

  const {data: eventData, ...eventResult} = useApiQuery<FeedbackEvent>(
    [`/organizations/${organization.slug}/issues/${feedbackId}/events/latest/`],
    {
      staleTime: 0,
    }
  );

  const tags = useMemo(() => hydrateEventTags(eventData), [eventData]);

  return {
    eventData,
    eventResult,
    issueData,
    issueResult,
    hasReplay,
    tags,
  };
}
