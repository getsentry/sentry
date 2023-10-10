import FeedbackErrorDetails from 'sentry/components/feedback/details/feedbackErrorDetails';
import FeedbackItem from 'sentry/components/feedback/feedbackItem/feedbackItem';
import useFetchFeedbackItem from 'sentry/components/feedback/useFetchFeedbackItem';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';

interface Props {
  feedbackSlug: string;
}

export default function FeedbackItemLoader({feedbackSlug}: Props) {
  const [projectSlug, feedbackId] = feedbackSlug.split(':');

  const organization = useOrganization();
  const project = useProjectFromSlug({organization, projectSlug});

  const {isLoading, isError, data} = useFetchFeedbackItem(
    {feedbackId, organization, project},
    {enabled: Boolean(project)}
  );

  return isLoading || !data ? (
    <Placeholder height="100%" />
  ) : isError || !project ? (
    <FeedbackErrorDetails error={t('Unable to load feedback')} />
  ) : (
    <FeedbackItem feedbackItem={data} />
  );
}
