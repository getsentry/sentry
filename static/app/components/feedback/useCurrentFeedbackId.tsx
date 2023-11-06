import decodeFeedbackId from 'sentry/components/feedback/decodeFeedbackId';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';

export default function useCurrentFeedbackId() {
  const {feedbackSlug} = useLocationQuery({
    fields: {
      feedbackSlug: decodeFeedbackId,
    },
  });
  return feedbackSlug;
}
