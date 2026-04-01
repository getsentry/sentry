import {useEffect} from 'react';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {FeedbackEmptyDetails} from 'sentry/components/feedback/details/feedbackEmptyDetails';
import {FeedbackErrorDetails} from 'sentry/components/feedback/details/feedbackErrorDetails';
import {FeedbackItem} from 'sentry/components/feedback/feedbackItem/feedbackItem';
import {useFeedbackSlug} from 'sentry/components/feedback/useFeedbackSlug';
import {useFetchFeedbackData} from 'sentry/components/feedback/useFetchFeedbackData';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {useSentryAppComponentsData} from 'sentry/stores/useSentryAppComponentsData';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

interface Props {
  onBackToList?: () => void;
}

export function FeedbackItemLoader({onBackToList}: Props = {}) {
  const organization = useOrganization();
  const [feedbackSlug] = useFeedbackSlug();
  const feedbackId = feedbackSlug?.feedbackId ?? '';

  const {issueResult, issueData, eventData} = useFetchFeedbackData({feedbackId});
  const projectId = issueData?.project?.id ?? feedbackSlug?.projectSlug;
  useSentryAppComponentsData({projectId});

  useEffect(() => {
    if (issueResult.isError) {
      trackAnalytics('feedback.feedback-item-not-found', {organization, feedbackId});
    }
  }, [organization, issueResult.isError, feedbackId]);

  useEffect(() => {
    if (issueData) {
      trackAnalytics('feedback.feedback-item-rendered', {organization});
    }
  }, [issueData, organization]);

  // There is a case where we are done loading, but we're fetching updates
  // This happens when the user has seen a feedback, clicks around a bit, then
  // lands on the same one again.
  // When the new data arrives the feedback status can flip from read to un-read
  // or resolved to unresolved, if something happened in another tab (or from
  // other user) to update the feedback.

  return issueResult.isPending && issueResult.isFetching ? (
    <Placeholder height="100%" />
  ) : issueResult.isError ? (
    <FeedbackErrorDetails error={t('Unable to load feedback')} />
  ) : issueData ? (
    <ErrorBoundary
      customComponent={() => (
        <FeedbackErrorDetails error={t('Unable to load feedback')} />
      )}
    >
      <FeedbackItem
        eventData={eventData}
        feedbackItem={issueData}
        onBackToList={onBackToList}
      />
    </ErrorBoundary>
  ) : (
    <FeedbackEmptyDetails />
  );
}
