import {useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';

import {useFeedbackApiOptions} from 'sentry/components/feedback/useFeedbackApiOptions';
import {useMutateFeedback} from 'sentry/components/feedback/useMutateFeedback';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';

interface Props {
  feedbackId: string;
}

export function useFetchFeedbackData({feedbackId}: Props) {
  const organization = useOrganization();
  const {getItemApiOptions} = useFeedbackApiOptions();
  const {issueApiOptions, eventApiOptions} = getItemApiOptions(feedbackId);

  const issueResult = useQuery(issueApiOptions);
  const issueData = issueResult.data;

  const {data: eventData} = useQuery(eventApiOptions);

  const {markAsRead} = useMutateFeedback({
    feedbackIds: [feedbackId],
    organization,
    projectIds: issueData?.project ? [issueData.project.id] : [],
  });

  const project = useProjectFromId({project_id: issueData?.project?.id});

  // TODO: it would be excellent if `PUT /issues/` could return the same data
  // as `GET /issues/` when query params are set. IE: it should expand inbox & owners.
  // Then we could avoid firing off 2-3 requests whenever a feedback is selected.
  // Until that is fixed, we're going to run `markAsRead` after the issue is
  // initially fetched in order to speedup initial fetch and avoid race conditions.
  useEffect(() => {
    if (project?.isMember && issueResult.isFetched && issueData && !issueData.hasSeen) {
      markAsRead(true);
    }
  }, [project?.isMember, issueData, issueResult.isFetched, markAsRead]);

  return {
    eventData,
    issueData,
    issueResult,
  };
}
