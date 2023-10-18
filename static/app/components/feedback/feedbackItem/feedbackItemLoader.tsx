import FeedbackErrorDetails from 'sentry/components/feedback/details/feedbackErrorDetails';
import FeedbackItem from 'sentry/components/feedback/feedbackItem/feedbackItem';
import useFetchFeedbackIssue from 'sentry/components/feedback/useFetchFeedbackIssue';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  feedbackSlug: string;
}

export default function FeedbackItemLoader({feedbackSlug}: Props) {
  const organization = useOrganization();

  const [, feedbackId] = feedbackSlug.split(':');
  const {
    isLoading: isIssueLoading,
    isError: isIssueError,
    data: issue,
  } = useFetchFeedbackIssue({feedbackId, organization});

  return isIssueLoading || !issue ? (
    <Placeholder height="100%" />
  ) : isIssueError ? (
    <FeedbackErrorDetails error={t('Unable to load feedback')} />
  ) : (
    <FeedbackItem feedbackItem={issue} />
  );
}
