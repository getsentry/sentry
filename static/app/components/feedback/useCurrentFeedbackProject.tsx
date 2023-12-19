import decodeFeedbackSlug from 'sentry/components/feedback/decodeFeedbackSlug';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';

export default function useCurrentFeedbackProject() {
  const {feedbackSlug} = useLocationQuery({
    fields: {
      feedbackSlug: val => decodeFeedbackSlug(val).projectSlug ?? '',
    },
  });
  return feedbackSlug;
}
