import FeedbackEmptyDetails from 'sentry/components/feedback/details/feedbackEmptyDetails';
import FeedbackErrorDetails from 'sentry/components/feedback/details/feedbackErrorDetails';
import FeedbackItem from 'sentry/components/feedback/feedbackItem/feedbackItem';
import useFeedbackItemQueryKey from 'sentry/components/feedback/useFeedbackItemQueryKey';
import useFetchFeedbackData from 'sentry/components/feedback/useFetchFeedbackData';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

export default function FeedbackItemLoader() {
  const organization = useOrganization();

  const queryKeys = useFeedbackItemQueryKey({organization});
  const {
    issueResult,
    issueData: feedbackIssue,
    tags,
    eventData: feedbackEvent,
  } = useFetchFeedbackData(queryKeys);

  // There is a case where we are done loading, but we're fetching updates
  // This happens when the user has seen a feedback, clicks around a bit, then
  // lands on the same one again.
  // When the new data arrives the feedback status can flip from read to un-read
  // or resolved to unresolved, if something happened in another tab (or from
  // other user) to update the feedback.

  return issueResult.isLoading && issueResult.isFetching ? (
    <Placeholder height="100%" />
  ) : issueResult.isError ? (
    <FeedbackErrorDetails error={t('Unable to load feedback')} />
  ) : !feedbackIssue ? (
    <FeedbackEmptyDetails />
  ) : (
    <FeedbackItem
      eventData={feedbackEvent}
      feedbackItem={feedbackIssue}
      refetchIssue={issueResult.refetch}
      tags={tags}
    />
  );
}
