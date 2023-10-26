import {useMemo} from 'react';

import hydrateEventTags from 'sentry/components/feedback/hydrateEventTags';
import type {FeedbackEvent, FeedbackIssue} from 'sentry/utils/feedback/types';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';

interface Props {
  eventQueryKey: ApiQueryKey | undefined;
  issueQueryKey: ApiQueryKey | undefined;
}

export default function useFetchFeedbackData({issueQueryKey, eventQueryKey}: Props) {
  const {data: issueData, ...issueResult} = useApiQuery<FeedbackIssue>(
    issueQueryKey ?? [''],
    {
      staleTime: 0,
      enabled: Boolean(issueQueryKey),
    }
  );

  const {data: eventData, ...eventResult} = useApiQuery<FeedbackEvent>(
    eventQueryKey ?? [''],
    {
      staleTime: 0,
      enabled: Boolean(eventQueryKey),
    }
  );

  const tags = useMemo(() => hydrateEventTags(eventData), [eventData]);

  return {
    eventData,
    eventResult,
    issueData,
    issueResult,
    tags,
  };
}
