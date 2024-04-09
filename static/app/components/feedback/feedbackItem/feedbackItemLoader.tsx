import FeedbackEmptyDetails from 'sentry/components/feedback/details/feedbackEmptyDetails';
import FeedbackErrorDetails from 'sentry/components/feedback/details/feedbackErrorDetails';
import FeedbackItem from 'sentry/components/feedback/feedbackItem/feedbackItem';
import useCurrentFeedbackId from 'sentry/components/feedback/useCurrentFeedbackId';
import useCurrentFeedbackProject from 'sentry/components/feedback/useCurrentFeedbackProject';
import useFetchFeedbackData from 'sentry/components/feedback/useFetchFeedbackData';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import useSentryAppComponentsData from 'sentry/stores/useSentryAppComponentsData';

export default function FeedbackItemLoader() {
  const feedbackId = useCurrentFeedbackId();
  const {issueResult, issueData, tags, eventData} = useFetchFeedbackData({feedbackId});

  const projectSlug = useCurrentFeedbackProject();
  useSentryAppComponentsData({projectId: projectSlug});

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
  ) : !issueData ? (
    <FeedbackEmptyDetails />
  ) : (
    <FeedbackItem eventData={eventData} feedbackItem={issueData} tags={tags} />
  );
}
