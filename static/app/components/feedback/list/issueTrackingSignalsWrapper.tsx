import IssueTrackingSignals from 'sentry/components/feedback/list/issueTrackingSignals';
import useFetchFeedbackData from 'sentry/components/feedback/useFetchFeedbackData';
import {Group} from 'sentry/types';
import {FeedbackIssue} from 'sentry/utils/feedback/types';

interface Props {
  feedbackIssue: FeedbackIssue;
}

export default function IssueTrackingSignalsWrapper({feedbackIssue}: Props) {
  const {issueData, eventData} = useFetchFeedbackData({feedbackId: feedbackIssue.id});

  return eventData && issueData ? (
    <IssueTrackingSignals
      event={eventData}
      group={issueData as unknown as Group}
      project={feedbackIssue.project}
    />
  ) : null;
}
